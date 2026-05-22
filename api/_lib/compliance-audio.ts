/**
 * AI Disclosure Audio — pre-rendered compliance clip.
 *
 * FCC Feb 2024 ruling: AI disclosure must be in the FIRST 5 seconds of every call.
 * This module generates and caches a ~2s clip per tenant:
 *   "This call is from an AI assistant on behalf of [tenant.name]."
 *
 * Storage: Supabase Storage → compliance-disclosure/{tenantId}.mp3
 * TTS: ElevenLabs Flash v2.5 (same pipeline as cold-open pre-render)
 *
 * Usage:
 *   import { getOrCreateDisclosureAudio } from "../_lib/compliance-audio";
 *   const url = await getOrCreateDisclosureAudio(tenantId, tenantName);
 */

const clean = (v: string | undefined) => (v || "").replace(/\\n/g, "").trim();
const SUPABASE_URL              = clean(process.env.SUPABASE_URL);
const SUPABASE_SERVICE_ROLE_KEY = clean(process.env.SUPABASE_SERVICE_ROLE_KEY);
const ELEVENLABS_API_KEY        = clean(process.env.ELEVENLABS_API_KEY);
const ELEVENLABS_MODEL          = process.env.ELEVENLABS_MODEL || "eleven_flash_v2_5";
const ELEVENLABS_VOICE          = process.env.ELEVENLABS_VOICE_ID || "pNInz6obpgDQGcFmaJgB";

// Fallback: a static generic disclosure clip URL (tenant-agnostic).
// If this URL doesn't exist yet, the system falls back to Hume prompt-based disclosure.
const GENERIC_DISCLOSURE_URL = process.env.GENERIC_DISCLOSURE_URL || "";

/**
 * Returns the public URL of the cached AI disclosure clip for a tenant.
 * Creates it via ElevenLabs TTS if it doesn't exist.
 * Falls back to a generic clip or empty string if TTS fails.
 */
export async function getOrCreateDisclosureAudio(
  tenantId: string,
  tenantName: string,
): Promise<string> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return GENERIC_DISCLOSURE_URL;

  const fileName = `compliance-disclosure/${tenantId}.mp3`;
  const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${fileName}`;

  // 1. Check if the file already exists (HEAD request to public URL)
  try {
    const headRes = await fetch(publicUrl, { method: "HEAD", signal: AbortSignal.timeout(3000) });
    if (headRes.ok) return publicUrl; // cached, return immediately
  } catch { /* not cached yet, generate */ }

  // 2. Generate via ElevenLabs
  if (!ELEVENLABS_API_KEY) {
    console.warn("[compliance-audio] ELEVENLABS_API_KEY not set, falling back to generic");
    return GENERIC_DISCLOSURE_URL;
  }

  const safeName = tenantName.replace(/[<>&"']/g, "").slice(0, 80) || "our company";
  const text = `This call is from an AI assistant on behalf of ${safeName}.`;

  try {
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
            stability: 0.75,
            similarity_boost: 0.80,
            style: 0.2,
            use_speaker_boost: false,
          },
        }),
        signal: AbortSignal.timeout(10000),
      }
    );

    if (!ttsRes.ok) {
      console.warn(`[compliance-audio] ElevenLabs ${ttsRes.status}`);
      return GENERIC_DISCLOSURE_URL;
    }

    const audioBuffer = await ttsRes.arrayBuffer();
    const audioBytes = new Uint8Array(audioBuffer);

    // 3. Upload to Supabase Storage
    const uploadRes = await fetch(
      `${SUPABASE_URL}/storage/v1/object/${fileName}`,
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
      console.warn(`[compliance-audio] Storage upload ${uploadRes.status}`);
      return GENERIC_DISCLOSURE_URL;
    }

    return publicUrl;
  } catch (err: any) {
    console.warn("[compliance-audio] generation failed:", err?.message);
    return GENERIC_DISCLOSURE_URL;
  }
}
