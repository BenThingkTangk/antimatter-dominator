import { Mic, MicOff } from "lucide-react";

interface Props {
  status: { enabled: boolean; stt: string; tts: string; pipeline: string } | null;
  active: boolean;
  onToggle: () => void;
}

/**
 * Voice-mode toggle. When voice isn't production-ready it renders as a clearly
 * labelled "planned" control (disabled, no mic permission requested). When the
 * STT/TTS services are live (config.voice.enabled), it becomes interactive.
 */
export function VoiceModeToggle({ status, active, onToggle }: Props) {
  const live = Boolean(status?.enabled);
  return (
    <button
      type="button"
      onClick={live ? onToggle : undefined}
      disabled={!live}
      aria-label={live ? (active ? "Stop voice mode" : "Start voice mode") : "Voice mode (planned)"}
      title={live ? "Voice mode" : `Voice mode — planned (${status?.pipeline || "Parakeet → 70B → Kokoro"})`}
      className="w-8 h-8 rounded-lg flex items-center justify-center transition-all relative disabled:cursor-not-allowed"
      style={{
        background: active ? "color-mix(in oklab, var(--atom-primary, #22e6d6) 24%, transparent)" : "transparent",
        color: live ? "var(--atom-primary, #22e6d6)" : "var(--color-text-faint, #7b8a90)",
        border: "1px solid var(--color-border, rgba(255,255,255,0.08))",
        opacity: live ? 1 : 0.55,
      }}
    >
      {active && live ? <Mic size={14} /> : <MicOff size={14} />}
      {!live && (
        <span
          className="absolute -top-1 -right-1 text-[7px] px-1 rounded-full"
          style={{ background: "var(--color-surface-3, #181f24)", color: "var(--color-text-faint, #7b8a90)" }}
        >
          soon
        </span>
      )}
    </button>
  );
}
