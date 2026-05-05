/**
 * Combined RAG endpoint — company intelligence proxy + module generation
 * Keeps us under Vercel's 12 serverless function limit
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const RAG_URL = process.env.RAG_URL || "https://atom-rag.45-79-202-76.sslip.io";

// ─── Forward to RAG microservice ─────────────────────────────────────────────
async function forwardToRag(path: string, body?: any, method = "POST"): Promise<any> {
  const res = await fetch(`${RAG_URL}${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(120000),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`RAG service error ${res.status}: ${text}`);
  }
  return res.json();
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    return res.status(204).end();
  }

  // Read action from query params OR body (WarBook sends in body, status checks use query)
  const action = (req.query.action as string) || req.body?.action;
  const company = (req.query.company as string) || req.body?.company_name || req.body?.company;

  try {
    switch (action) {
      // ── Company management ──────────────────────────────────────────────────
      case "load":
        return res.json(await forwardToRag("/company/load", req.body));

      case "status":
        return res.json(await forwardToRag(`/company/${encodeURIComponent(company)}/status`, undefined, "GET"));

      case "context":
        return res.json(await forwardToRag("/company/context", req.body));

      case "query":
        // WarBook query — forward to RAG context endpoint
        return res.json(await forwardToRag("/company/context", {
          company_name: req.body?.company_name,
          module: req.body?.module || "warbook",
          question: req.body?.question,
        }));

      case "companies":
        return res.json(await forwardToRag("/companies", undefined, "GET"));

      case "delete":
        return res.json(await forwardToRag(`/company/${encodeURIComponent(company)}`, undefined, "DELETE"));

      // ── RAG-powered generation ──────────────────────────────────────────────
      case "pitch":
        return res.json(await forwardToRag("/pitch/generate", req.body));

      case "objection":
        return res.json(await forwardToRag("/objections/handle", req.body));

      // ── Utility ──────────────────────────────────────────────────────────────
      case "health":
        return res.json(await forwardToRag("/", undefined, "GET"));

      // ── Pickup-delay killer ──────────────────────────────────────────────────
      // Frontend calls this when the user types/selects a product, so the
      // RAG is HOT by the time they click Dial. Returns immediately even if
      // the load is still ingesting — the next /company/context call will
      // be warm. Idempotent. Safe to fire on every product-field debounce.
      case "prewarm": {
        const productName = req.body?.company_name || req.body?.product || company;
        if (!productName) return res.status(400).json({ error: "product/company_name required" });

        // Fire load (background ingest if cold) AND context (warm hit if hot)
        // simultaneously. We don't wait for either fully — we just want both
        // pipes primed. RAG service caches both calls server-side.
        const loadPromise = forwardToRag("/company/load", { company_name: productName })
          .catch((e: any) => ({ error: e.message }));
        const ctxPromise = forwardToRag("/company/context", {
          company_name: productName,
          module: "pitch",
          query: "prewarm",
        }).catch((e: any) => ({ error: e.message }));

        // Race with a 1.2s budget — we don't want the frontend hanging.
        const result = await Promise.race([
          Promise.all([loadPromise, ctxPromise]).then(([load, ctx]) => ({
            load, ctx, status: "complete" as const,
          })),
          new Promise<{ status: "primed"; message: string }>((resolve) =>
            setTimeout(() => resolve({ status: "primed", message: "prewarm dispatched" }), 1200)
          ),
        ]);
        return res.json(result);
      }

      default:
        return res.status(400).json({ error: `Unknown action: ${action}. Use: load|status|context|companies|pitch|objection|prewarm|health` });
    }
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "RAG service unavailable" });
  }
}
