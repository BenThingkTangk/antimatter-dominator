/**
 * POST /api/atom-leadgen/pre-render-opener
 *
 * Pre-renders a cold-open audio clip using ElevenLabs Flash v2.5 TTS, then
 * uploads the mp3 to Supabase Storage and stores the public URL on the
 * campaign account row.
 *
 * Fire-and-forget from the enrichment pipeline — called automatically after
 * enrichment completes for each account.
 *
 * Body: { accountId: number, campaignId: number, contactName: string,
 *         companyName: string, productLabel: string, openerText?: string }
 *
 * If ELEVENLABS_API_KEY is not set, silently returns { rendered: false }.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";

const clean = (v: string | undefined) => (v || "").replace(/\\n/g, "").trim();
const SUPABASE_URL              = clean(process.env.SUPABASE_URL);
const SUPABASE_SERVICE_ROLE_KEY = clean(process.env.SUPABASE_SERVICE_ROLE_KEY);
const ELEVENLABS_API_KEY        = clean(process.env.ELEVENLABS_API_KEY);

// Flash v2.5 model — lowest latency for pre-rendering
const ELEVENLABS_MODEL  = process.env.ELEVENLABS_MODEL || "eleven_flash_v2_5";
// Default voice — "Adam" (versatile male, good for cold-calling). Override via env.
const ELEVENLABS_VOICE  = process.env.ELEVENLABS_VOICE_ID || "pNInz6obpgDQGcFmaJgB";

async function sb(path: string, init: RequestInit = {}) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(init.headers || {}),
    },
  });
  const t = await r.text();
  if (!r.ok) throw new Error(`Supabase ${r.status}: ${t.slice(0, 260)}`);
  return t ? JSON.parse(t) : null;
}

function defaultOpener(contact: string, company: string, product: string): string {
  const first = contact.split(/\s+/)[0] || "there";
  return `Hey ${first}, this is Adam from ${product}. I noticed ${company} has been expanding — I had a quick idea on how we could help. Got thirty seconds?`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") { res.status(204).end(); return; }
  if (req.method !== "POST") return res.status(405).json({ error: "method" });

  if (!ELEVENLABS_API_KEY) {
    return res.status(200).json({ rendered: false, reason: "elevenlabs_not_configured" });
  }
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ error: "supabase not configured" });
  }

  const b = req.body || {};
  const accountId   = Number(b.accountId);
  const campaignId  = Number(b.campaignId);
  const contactName = String(b.contactName || "").trim();
  const companyName = String(b.companyName || "").trim();
  const productLabel = String(b.productLabel || "AntimatterAI").trim();

  if (!accountId || !campaignId) {
    return res.status(400).json({ error: "accountId and campaignId required" });
  }
  if (!contactName) {
    return res.status(200).json({ rendered: false, reason: "no_contact_name" });
  }

  const text = b.openerText || defaultOpener(contactName, companyName, productLabel);

  try {
    // 1. Call ElevenLabs TTS
    const ttsRes = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE}`,
      {
        method: "POST",
        headers: {
          "xi-api-key": ELEVENLABS_API_KEY,
          "Content-Type": "application/json",
          Accept: "audio/mpeg",
        },
        body: JSON.stringify({
          text,
          model_id: ELEVENLABS_MODEL,
          voice_settings: {
            stability: 0.65,
            similarity_boost: 0.78,
            style: 0.4,
            use_speaker_boost: true,
          },
        }),
      }
    );

    if (!ttsRes.ok) {
      const errText = await ttsRes.text().catch(() => "");
      return res.status(502).json({ error: `ElevenLabs ${ttsRes.status}: ${errText.slice(0, 200)}` });
    }

    const audioBuffer = await ttsRes.arrayBuffer();
    const audioBytes = new Uint8Array(audioBuffer);

    // 2. Upload to Supabase Storage (bucket: atom-audio)
    const fileName = `cold-open/${campaignId}/${accountId}-${Date.now()}.mp3`;
    const uploadRes = await fetch(
      `${SUPABASE_URL}/storage/v1/object/atom-audio/${fileName}`,
      {
        method: "POST",
        headers: {
          apikey: SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          "Content-Type": "audio/mpeg",
          "x-upsert": "true",
        },
        body: audioBytes,
      }
    );

    if (!uploadRes.ok) {
      const ut = await uploadRes.text().catch(() => "");
      return res.status(502).json({ error: `Storage upload ${uploadRes.status}: ${ut.slice(0, 200)}` });
    }

    // 3. Get public URL
    const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/atom-audio/${fileName}`;

    // 4. Update campaign account row with the audio URL
    await sb(`atom_campaign_accounts?id=eq.${accountId}`, {
      method: "PATCH",
      body: JSON.stringify({
        cold_open_audio_url: publicUrl,
      }),
      headers: { Prefer: "return=minimal" } as any,
    });

    return res.status(200).json({
      rendered: true,
      audioUrl: publicUrl,
      accountId,
      textLength: text.length,
      audioSize: audioBytes.length,
    });
  } catch (err: any) {
    console.error("[pre-render-opener]", err);
    return res.status(500).json({ error: err?.message || "pre-render failed" });
  }
}
