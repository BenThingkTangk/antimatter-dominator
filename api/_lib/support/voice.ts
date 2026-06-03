/**
 * Voice-mode foundation (PLANNED — architecture + contracts only).
 *
 * Pipeline:  Parakeet STT  ->  70B answer/RAG (existing support chat)  ->  Kokoro TTS
 *
 * This module defines the API CONTRACTS and a feature gate so the UI can render
 * a voice toggle that clearly says "planned" until the STT/TTS services are
 * wired. No browser mic permissions are requested until the toggle is enabled
 * AND ATOM_SUPPORT_ENABLE_VOICE=true. Designed for future Quest 3S / WebXR:
 * the contracts are transport-agnostic (HTTP now, WebRTC/WebSocket later).
 */
const clean = (v: string | undefined) => (v || "").replace(/\\n/g, "").trim();

const VOICE_ENABLED = clean(process.env.ATOM_SUPPORT_ENABLE_VOICE).toLowerCase() === "true";
const STT_URL = clean(process.env.PARAKEET_STT_URL);
const TTS_URL = clean(process.env.KOKORO_TTS_URL);

export interface SttRequest {
  /** base64 PCM/opus audio or a URL to an uploaded clip. */
  audio: string;
  encoding?: "pcm16" | "opus" | "wav";
  sampleRate?: number;
  language?: string;
}
export interface SttResponse {
  transcript: string;
  confidence: number;
  durationMs: number;
  provider: "parakeet" | "mock";
}

export interface TtsRequest {
  text: string;
  voice?: string;     // Kokoro voice id
  speed?: number;
}
export interface TtsResponse {
  /** base64 audio (wav/mp3) or a URL. */
  audio: string;
  format: "wav" | "mp3";
  provider: "kokoro" | "mock";
}

export type VoiceStatus = "live" | "planned";

export function voiceStatus(): {
  enabled: boolean;
  stt: VoiceStatus;
  llm: VoiceStatus;
  tts: VoiceStatus;
  pipeline: string;
} {
  return {
    enabled: VOICE_ENABLED && Boolean(STT_URL) && Boolean(TTS_URL),
    stt: STT_URL ? "live" : "planned",
    llm: "live", // reuses the support chat LLM path
    tts: TTS_URL ? "live" : "planned",
    pipeline: "Parakeet STT → 70B RAG → Kokoro TTS",
  };
}

export async function transcribe(req: SttRequest): Promise<SttResponse> {
  if (!VOICE_ENABLED || !STT_URL) {
    return { transcript: "", confidence: 0, durationMs: 0, provider: "mock" };
  }
  const r = await fetch(`${STT_URL.replace(/\/$/, "")}/transcribe`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
    signal: AbortSignal.timeout(20000),
  });
  if (!r.ok) throw new Error(`parakeet ${r.status}`);
  const d: any = await r.json();
  return {
    transcript: d?.transcript || "",
    confidence: d?.confidence ?? 0,
    durationMs: d?.duration_ms ?? 0,
    provider: "parakeet",
  };
}

export async function synthesize(req: TtsRequest): Promise<TtsResponse> {
  if (!VOICE_ENABLED || !TTS_URL) {
    return { audio: "", format: "wav", provider: "mock" };
  }
  const r = await fetch(`${TTS_URL.replace(/\/$/, "")}/synthesize`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
    signal: AbortSignal.timeout(20000),
  });
  if (!r.ok) throw new Error(`kokoro ${r.status}`);
  const d: any = await r.json();
  return { audio: d?.audio || "", format: d?.format || "wav", provider: "kokoro" };
}
