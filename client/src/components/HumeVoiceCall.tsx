import { useState, useEffect, useRef, useCallback } from "react";
import { VoiceProvider, useVoice } from "@humeai/voice-react";
import { apiRequest } from "@/lib/queryClient";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Phone, PhoneOff, Mic, MicOff, Radio, Activity,
  User, Brain, TrendingUp, AlertTriangle, Target, Loader2
} from "lucide-react";

// ─── Emotion Processing ───────────────────────────────────────────

interface EmotionScores {
  [key: string]: number;
}

function computeSentiment(scores: EmotionScores): number {
  const positive = ["Joy", "Interest", "Excitement", "Amusement", "Admiration", "Contentment", "Satisfaction", "Love", "Determination", "Realization"];
  const negative = ["Anger", "Disgust", "Fear", "Sadness", "Contempt", "Distress", "Disappointment", "Embarrassment", "Shame", "Anxiety"];
  let posSum = 0, negSum = 0;
  for (const [k, v] of Object.entries(scores)) {
    if (positive.some(p => k.toLowerCase().includes(p.toLowerCase()))) posSum += v;
    if (negative.some(n => k.toLowerCase().includes(n.toLowerCase()))) negSum += v;
  }
  const total = posSum + negSum || 1;
  return Math.round(((posSum / total) * 100));
}

function computeBuyerIntent(scores: EmotionScores, messageCount: number): number {
  const intentSignals = ["Interest", "Curiosity", "Determination", "Concentration", "Contemplation", "Realization"];
  let signalSum = 0, count = 0;
  for (const [k, v] of Object.entries(scores)) {
    if (intentSignals.some(s => k.toLowerCase().includes(s.toLowerCase()))) {
      signalSum += v;
      count++;
    }
  }
  const base = count > 0 ? (signalSum / count) * 100 : 30;
  const progression = Math.min(messageCount * 3, 20);
  return Math.min(Math.round(base + progression), 100);
}

function getTopEmotions(scores: EmotionScores, limit = 6): { name: string; value: number }[] {
  return Object.entries(scores)
    .map(([name, value]) => ({ name, value: Math.round(value * 100) }))
    .sort((a, b) => b.value - a.value)
    .slice(0, limit);
}

// ─── Radial Gauge ─────────────────────────────────────────────────

function MiniGauge({ value, label, color }: { value: number; label: string; color: string }) {
  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  const progress = (value / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-1">
      <svg width="88" height="88" viewBox="0 0 88 88">
        <circle cx="44" cy="44" r={radius} fill="none" stroke="hsl(var(--muted))" strokeWidth="6" />
        <circle
          cx="44" cy="44" r={radius} fill="none" stroke={color} strokeWidth="6"
          strokeDasharray={circumference} strokeDashoffset={circumference - progress}
          strokeLinecap="round" transform="rotate(-90 44 44)"
          className="transition-all duration-700 ease-out"
        />
        <text x="44" y="40" textAnchor="middle" fill="currentColor" className="text-lg font-bold" fontSize="18">{value}</text>
        <text x="44" y="56" textAnchor="middle" fill="hsl(var(--muted-foreground))" fontSize="9">/100</text>
      </svg>
      <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{label}</span>
    </div>
  );
}

// ─── Live Call Interface ──────────────────────────────────────────

function LiveCallInterface({ companyName, contactName, productName }: {
  companyName: string; contactName: string; productName: string;
}) {
  const { status, messages, connect, disconnect, isMuted, mute, unmute, micFft } = useVoice();
  const [sentiment, setSentiment] = useState(50);
  const [buyerIntent, setBuyerIntent] = useState(30);
  const [topEmotions, setTopEmotions] = useState<{ name: string; value: number }[]>([]);
  const [qualification, setQualification] = useState<string>("Unqualified");
  const [callDuration, setCallDuration] = useState(0);
  const [aiRec, setAiRec] = useState("Waiting for conversation to begin...");
  const [objections, setObjections] = useState<string[]>([]);
  const timerRef = useRef<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Call duration timer
  useEffect(() => {
    if (status.value === "connected") {
      timerRef.current = setInterval(() => setCallDuration(prev => prev + 1), 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [status.value]);

  // Process emotion data from messages
  useEffect(() => {
    if (messages.length === 0) return;
    const lastMsg = messages[messages.length - 1];
    if ((lastMsg.type === "user_message" || lastMsg.type === "assistant_message") && lastMsg.models?.prosody?.scores) {
      const scores = lastMsg.models.prosody.scores;
      setSentiment(computeSentiment(scores));
      setBuyerIntent(computeBuyerIntent(scores, messages.length));
      setTopEmotions(getTopEmotions(scores));

      // AI recommendations based on emotions
      const topEmotion = getTopEmotions(scores, 1)[0]?.name || "";
      if (topEmotion.toLowerCase().includes("skeptic") || topEmotion.toLowerCase().includes("doubt")) {
        setAiRec("Prospect is skeptical — provide concrete ROI data and case studies");
        if (!objections.includes("Skepticism detected")) setObjections(prev => [...prev, "Skepticism detected"]);
      } else if (topEmotion.toLowerCase().includes("interest") || topEmotion.toLowerCase().includes("curio")) {
        setAiRec("High interest detected — probe deeper on specific use cases and timeline");
      } else if (topEmotion.toLowerCase().includes("frustrat") || topEmotion.toLowerCase().includes("anger")) {
        setAiRec("Frustration detected — acknowledge concerns, pivot to value proposition");
        if (!objections.includes("Frustration/resistance")) setObjections(prev => [...prev, "Frustration/resistance"]);
      } else if (topEmotion.toLowerCase().includes("excit") || topEmotion.toLowerCase().includes("joy")) {
        setAiRec("Strong positive signal — move toward scheduling a demo or next meeting");
      } else {
        setAiRec("Continue building rapport — ask about their current challenges");
      }

      // Qualification updates
      const currentIntent = computeBuyerIntent(scores, messages.length);
      const currentSentiment = computeSentiment(scores);
      if (currentIntent > 70 && currentSentiment > 50) setQualification("Hot Lead");
      else if (currentIntent > 50) setQualification("Qualified");
      else if (currentIntent > 30) setQualification("Warming");
      else setQualification("Unqualified");
    }
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const formatDuration = (s: number) => `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;

  const qualColors: Record<string, string> = {
    "Unqualified": "bg-muted text-muted-foreground",
    "Warming": "bg-amber-500/15 text-amber-500",
    "Qualified": "bg-blue-500/15 text-blue-500",
    "Hot Lead": "bg-rose-500/15 text-rose-500",
  };

  return (
    <div className="space-y-4">
      {/* Call Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {status.value === "connected" && <div className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />}
          <div>
            <h3 className="text-sm font-semibold">
              {status.value === "connected" ? `ATOM Live Call — ${contactName} at ${companyName}` : "ATOM Voice Ready"}
            </h3>
            <p className="text-xs text-muted-foreground">
              {status.value === "connected" ? `${formatDuration(callDuration)} · ${productName}` : "Ring, pick up, say hello — ATOM will greet them by name"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {status.value === "connected" && (
            <>
              <Badge className={qualColors[qualification]}>{qualification}</Badge>
              <Badge className="bg-rose-500/15 text-rose-500 gap-1">
                <Radio className="w-3 h-3 animate-pulse" />Recording
              </Badge>
            </>
          )}
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left: Transcript */}
        <Card className="border-border/50 lg:col-span-1">
          <div className="p-3">
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-2">Live Transcript</p>
            <div className="h-[400px] overflow-y-auto space-y-2 pr-1">
              {messages.filter(m => m.type === "user_message" || m.type === "assistant_message").map((msg, i) => {
                const isAtom = msg.type === "assistant_message";
                return (
                  <div key={i} className={`flex gap-2 ${isAtom ? "" : "flex-row-reverse"}`}>
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${isAtom ? "bg-primary/20" : "bg-muted"}`}>
                      {isAtom ? <Brain className="w-3 h-3 text-primary" /> : <User className="w-3 h-3" />}
                    </div>
                    <div className={`max-w-[85%] rounded-lg p-2 text-xs ${isAtom ? "bg-primary/10 text-foreground" : "bg-muted text-foreground"}`}>
                      <p className="text-[10px] font-medium text-muted-foreground mb-0.5">{isAtom ? "ATOM" : "Contact"}</p>
                      <p className="leading-relaxed">{msg.message?.content || ""}</p>
                    </div>
                  </div>
                );
              })}
              {messages.length === 0 && status.value === "connected" && (
                <div className="flex flex-col items-center gap-1 text-muted-foreground text-xs py-8 justify-center">
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Line open — waiting for pickup…</span>
                  </div>
                  <span className="text-[10px] opacity-70">ATOM stays silent until the prospect says “hello”</span>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </div>
        </Card>

        {/* Center: Gauges & Emotions */}
        <Card className="border-border/50 lg:col-span-1">
          <div className="p-3 space-y-4">
            {/* Gauges */}
            <div className="flex justify-center gap-6">
              <MiniGauge
                value={sentiment}
                label="Sentiment"
                color={sentiment >= 60 ? "hsl(150, 60%, 45%)" : sentiment >= 30 ? "hsl(40, 80%, 55%)" : "hsl(0, 72%, 50%)"}
              />
              <MiniGauge
                value={buyerIntent}
                label="Buyer Intent"
                color={buyerIntent >= 70 ? "hsl(150, 60%, 45%)" : buyerIntent >= 40 ? "hsl(190, 95%, 50%)" : "hsl(220, 14%, 50%)"}
              />
            </div>

            {/* Emotional Tones */}
            <div>
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-2">Emotional Tones (Live)</p>
              <div className="space-y-1.5">
                {topEmotions.length > 0 ? topEmotions.map((e, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-[10px] w-24 truncate text-muted-foreground">{e.name}</span>
                    <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                      <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${e.value}%` }} />
                    </div>
                    <span className="text-[10px] font-mono text-muted-foreground w-8 text-right">{e.value}%</span>
                  </div>
                )) : (
                  <p className="text-xs text-muted-foreground text-center py-4">Emotions will appear during the call</p>
                )}
              </div>
            </div>

            {/* AI Recommendation */}
            <div className="p-2.5 rounded-lg bg-primary/5 border border-primary/20">
              <div className="flex items-start gap-2">
                <Brain className="w-3.5 h-3.5 text-primary mt-0.5 shrink-0" />
                <div>
                  <p className="text-[10px] font-medium text-primary uppercase tracking-wider">AI Recommendation</p>
                  <p className="text-xs mt-0.5">{aiRec}</p>
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* Right: Intel & Controls */}
        <Card className="border-border/50 lg:col-span-1">
          <div className="p-3 space-y-3">
            {/* Company Info */}
            <div>
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1">Target</p>
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">{contactName || "Unknown Contact"}</p>
                  <p className="text-xs text-muted-foreground">{companyName || "Unknown Company"} · {productName}</p>
                </div>
              </div>
            </div>

            {/* Objections Detected */}
            {objections.length > 0 && (
              <div>
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1">Objections Detected</p>
                <div className="space-y-1">
                  {objections.map((o, i) => (
                    <div key={i} className="flex items-center gap-1.5">
                      <AlertTriangle className="w-3 h-3 text-amber-500" />
                      <span className="text-xs">{o}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Mic Visualization */}
            {status.value === "connected" && micFft && (
              <div>
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1">Audio Level</p>
                <div className="flex items-end gap-0.5 h-8">
                  {Array.from(micFft).slice(0, 24).map((val, i) => (
                    <div
                      key={i}
                      className="flex-1 rounded-sm bg-primary/60 transition-all duration-75"
                      style={{ height: `${Math.max(val * 100, 4)}%` }}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Call Controls */}
            <div className="pt-2 border-t border-border/50 space-y-2">
              {status.value !== "connected" ? (
                <Button className="w-full gap-2" onClick={() => connect()} disabled={status.value === "connecting"}>
                  {status.value === "connecting" ? (
                    <><Loader2 className="w-4 h-4 animate-spin" />Connecting...</>
                  ) : (
                    <><Phone className="w-4 h-4" />Start Live Voice Call</>
                  )}
                </Button>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="outline" size="sm" onClick={() => isMuted ? unmute() : mute()} className="gap-1">
                    {isMuted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                    {isMuted ? "Unmute" : "Mute"}
                  </Button>
                  <Button variant="destructive" size="sm" onClick={() => disconnect()} className="gap-1">
                    <PhoneOff className="w-3.5 h-3.5" />End Call
                  </Button>
                </div>
              )}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

// ─── Wrapper with VoiceProvider ───────────────────────────────────

export function HumeVoiceCallWrapper({ companyName, contactName, productName, productSlug }: {
  companyName: string; contactName: string; productName: string; productSlug: string;
}) {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [authType, setAuthType] = useState<"accessToken" | "apiKey">("accessToken");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchToken() {
      try {
        const res = await apiRequest("GET", "/api/atom-leadgen/hume-token");
        const data = await res.json();
        setAccessToken(data.accessToken);
        if (data.authType === "apiKey" || data.authType === "accessToken") {
          setAuthType(data.authType);
        }
      } catch (err: any) {
        setError(err.message || "Failed to initialize voice");
      } finally {
        setLoading(false);
      }
    }
    fetchToken();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="w-6 h-6 animate-spin text-primary mr-3" />
        <span className="text-sm">Initializing ATOM voice engine...</span>
      </div>
    );
  }

  if (error || !accessToken) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <AlertTriangle className="w-8 h-8 text-amber-500 mb-3" />
        <p className="text-sm font-medium">Voice engine unavailable</p>
        <p className="text-xs mt-1">{error || "Could not connect to Hume"}</p>
      </div>
    );
  }

  // ATOM Voice 2.0 — Pickup Detection + Steve Jobs Keynote voice
  // Prompt, voice, pickup-wait logic all live in the Hume EVI config.
  // We inject prospect context per session via sessionSettings.variables so the
  // agent can greet "Hey [FirstName]" after the caller picks up and says hello.
  const HUME_CONFIG_ID = "7ea7a073-3dfa-4b49-9877-44afeea5df70"; // ATOM Sales Agent v10 (Pickup + Jobs)
  const HUME_VOICE_ID = "1f8d0017-485c-4b65-b644-cc3995b019a6"; // ATOM Jobs Keynote

  const firstName = (contactName?.trim().split(/\s+/)[0]) || "there";

  return (
    <VoiceProvider
      auth={{ type: authType, value: accessToken }}
      configId={HUME_CONFIG_ID}
      sessionSettings={{
        voice: { id: HUME_VOICE_ID },
        variables: {
          first_name: firstName,
          company_name: companyName || "your company",
          product_name: productName || "our platform",
        },
      }}
    >
      <LiveCallInterface
        companyName={companyName}
        contactName={contactName}
        productName={productName}
      />
    </VoiceProvider>
  );
}
