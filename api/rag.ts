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

  const action = req.query.action as string;
  const company = (req.query.company as string) || req.body?.company_name;

  try {
    switch (action) {
      // ── Company management ──────────────────────────────────────────────────
      case "load":
        return res.json(await forwardToRag("/company/load", req.body));

      case "status":
        return res.json(await forwardToRag(`/company/${encodeURIComponent(company)}/status`, undefined, "GET"));

      case "context":
        return res.json(await forwardToRag("/company/context", req.body));

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

      default:
        return res.status(400).json({ error: `Unknown action: ${action}. Use: load|status|context|companies|pitch|objection|health` });
    }
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "RAG service unavailable" });
  }
}
