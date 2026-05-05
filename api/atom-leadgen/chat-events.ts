/**
 * ATOM Lead Gen — live chat events poller.
 *
 * The frontend polls this endpoint every ~2s during an active call.
 * We look up the Hume chat by its custom_session_id (= Twilio callSid)
 * and return:
 *   - transcript (USER_MESSAGE + AGENT_MESSAGE)
 *   - per-message emotion_features (48-dim)
 *   - derived sentiment score (-100..100)
 *   - derived buyer-intent score (0..100)
 *   - derived 6-emotion rollup for the UI bars
 *   - call stage (discovery / evaluation / negotiation / close)
 *
 * Zero state stored server-side — Hume is the source of truth.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";

const clean = (v: string | undefined) =>
  (v || "").replace(/\\n/g, "").trim();

const HUME_API_KEY   = clean(process.env.HUME_API_KEY);
const OPENAI_API_KEY = clean(process.env.OPENAI_API_KEY);

// Emotion groupings — map Hume's 48 expressions to the 6 UI bars.
const EMOTION_GROUPS: Record<string, string[]> = {
  confidence:  ["Confidence", "Determination", "Pride", "Triumph"],
  interest:    ["Interest", "Concentration", "Contemplation", "Realization"],
  skepticism:  ["Doubt", "Confusion", "Disappointment", "Contempt"],
  excitement:  ["Excitement", "Enthusiasm", "Joy", "Amusement", "Surprise (positive)"],
  frustration: ["Anger", "Annoyance", "Disgust", "Awkwardness", "Distress", "Tiredness"],
  neutrality:  ["Calmness", "Relief", "Satisfaction"],
};

// Positive emotions that push sentiment UP
const POS_EMOTIONS = new Set([
  "Joy", "Amusement", "Excitement", "Contentment", "Satisfaction", "Pride",
  "Triumph", "Admiration", "Interest", "Enthusiasm", "Calmness", "Relief",
  "Gratitude", "Love", "Desire", "Realization",
]);

// Negative emotions that push sentiment DOWN
const NEG_EMOTIONS = new Set([
  "Anger", "Annoyance", "Contempt", "Disgust", "Disappointment", "Distress",
  "Doubt", "Embarrassment", "Fear", "Guilt", "Sadness", "Shame", "Tiredness",
  "Awkwardness", "Anxiety", "Horror", "Pain",
]);

// Intent signals — emotions that indicate buying readiness
const HIGH_INTENT = new Set([
  "Interest", "Concentration", "Contemplation", "Realization", "Desire",
  "Excitement", "Enthusiasm", "Determination", "Admiration",
]);

interface HumeEvent {
  id: string;
  type: string;
  role?: string;
  message_text?: string;
  timestamp: number;
  emotion_features?: string; // JSON-encoded
  end_reason?: string;
}

async function findChatBySessionId(sessionId: string): Promise<string | null> {
  // Query Hume list chats and filter by custom_session_id.
  // We scan the 30 most recent chats (plenty for live calls).
  const url = `https://api.hume.ai/v0/evi/chats?page_number=0&page_size=30&ascending_order=false`;
  try {
    const r = await fetch(url, { headers: { "X-Hume-Api-Key": HUME_API_KEY } });
    if (!r.ok) return null;
    const data: any = await r.json();
    const chats: any[] = data.chats_page || [];
    for (const c of chats) {
      if (c.custom_session_id === sessionId) return c.id;
      if (c.metadata && typeof c.metadata === "string") {
        try {
          const md = JSON.parse(c.metadata);
          if (md.custom_session_id === sessionId) return c.id;
        } catch {}
      }
    }
  } catch {}
  return null;
}

async function fetchChatEvents(chatId: string): Promise<HumeEvent[]> {
  const url = `https://api.hume.ai/v0/evi/chats/${encodeURIComponent(chatId)}?page_number=0&page_size=100&ascending_order=true`;
  const r = await fetch(url, { headers: { "X-Hume-Api-Key": HUME_API_KEY } });
  if (!r.ok) return [];
  const data: any = await r.json();
  return (data.events_page as HumeEvent[]) || [];
}

function computeSentiment(emotions: Record<string, number>): number {
  let pos = 0, neg = 0;
  for (const [k, v] of Object.entries(emotions)) {
    if (POS_EMOTIONS.has(k)) pos += v;
    if (NEG_EMOTIONS.has(k)) neg += v;
  }
  // Range -100..100
  if (pos + neg < 0.001) return 0;
  return Math.round(((pos - neg) / (pos + neg)) * 100);
}

function computeIntent(emotions: Record<string, number>): number {
  let intent = 0;
  for (const [k, v] of Object.entries(emotions)) {
    if (HIGH_INTENT.has(k)) intent += v;
  }
  // Normalize: max realistic intent ~2.0 total
  return Math.min(100, Math.round((intent / 2.0) * 100));
}

function rollupEmotions(emotions: Record<string, number>): Record<string, number> {
  const rolled: Record<string, number> = {};
  for (const [group, members] of Object.entries(EMOTION_GROUPS)) {
    let sum = 0;
    for (const m of members) sum += emotions[m] || 0;
    rolled[group] = Math.min(1, sum / members.length);
  }
  return rolled;
}

function inferStage(transcript: { role: string; text: string }[]): 1 | 2 | 3 | 4 {
  const text = transcript.map(t => t.text.toLowerCase()).join(" ");
  if (/close|contract|sign|send.*agreement|proposal/.test(text)) return 4;
  if (/price|cost|budget|how much|pricing|discount/.test(text))    return 3;
  if (/demo|see it|show me|case study|reference|proof/.test(text)) return 2;
  return 1;
}

// ─── Buying signals ───────────────────────────────────────────────
// Lightweight regex-based extractor over the prospect's utterances. We DO
// NOT round-trip through OpenAI for this — it's deterministic, fast, and
// the patterns are good enough to populate the chips panel during a call.
// The previous version of this endpoint dropped this entirely. Restored.
const SIGNAL_PATTERNS: Array<{ re: RegExp; label: string }> = [
  { re: /how (does|do) (it|that|this) work/i,                          label: "asking how it works" },
  { re: /how much|what.*cost|pricing|price.*range|budget/i,            label: "asked about pricing" },
  { re: /(can|could) you (show|demo|walk me through)/i,                label: "requested a demo" },
  { re: /case study|reference|other client|who.*using/i,               label: "asking for proof / references" },
  { re: /increase revenue|grow.*revenue|more revenue|drive revenue/i,  label: "looking for ways to increase revenue" },
  { re: /save (us|me) (time|money)|reduce cost|cut cost/i,             label: "focused on cost reduction" },
  { re: /talk to (a |the )?(human|person|someone)|speak to.*human/i,   label: "requested to speak with a human" },
  { re: /follow.?up|circle back|call.*back|next week|tomorrow/i,       label: "agreed to follow-up" },
  { re: /send.*(info|email|deck|details)|email me/i,                   label: "requested info via email" },
  { re: /(sounds good|that's helpful|love that|interesting)/i,         label: "expressed positive interest" },
  { re: /(team|stakeholder|boss|partner|cto|cfo|ceo).*(decide|review)/i, label: "flagged stakeholders involved" },
  { re: /timeline|when.*available|how soon|by (q[1-4]|end of)/i,       label: "asking about timeline" },
  { re: /integrate|integration|works with|compatible/i,                label: "asking about integrations" },
  { re: /tried|using|currently|right now we/i,                         label: "shared current stack" },
  { re: /not (sure|interested)|maybe later|not (a |the )?(right|good) (time|fit)/i, label: "hesitation expressed" },
  { re: /next step|move forward|let.s do it|sign me up/i,              label: "ready to move forward" },
  { re: /security|compliance|soc.?2|gdpr|hipaa/i,                      label: "asking about security/compliance" },
  { re: /how.*tested|what.*tested|test.*for|run.*test/i,               label: "asking what's being tested" },
  { re: /interpret|explain.*results?|what does.*mean/i,                label: "asking how to interpret results" },
];

function extractBuyingSignals(transcript: { role: string; text: string }[]): string[] {
  const out = new Set<string>();
  for (const t of transcript) {
    if (t.role !== "user") continue;
    for (const { re, label } of SIGNAL_PATTERNS) {
      if (re.test(t.text)) out.add(label);
    }
  }
  return Array.from(out).slice(0, 12);
}

// ─── Von Clausewitz / Aletheia engine ────────────────────────────────────
// Lightweight analyzer that runs DIRECTLY here (not via a chained fetch) to
// keep latency under 800ms. Focused on the prospect's most recent utterance +
// short thread context.
async function runAletheia(
  latestUtterance: string,
  thread: { role: string; text: string }[],
  dealContext: string
): Promise<any | null> {
  if (!OPENAI_API_KEY || !latestUtterance || latestUtterance.length < 8) return null;

  const prompt = `You are the ATOM War Room — Von Clausewitz Engine. Decode what the prospect REALLY means in this live sales call utterance.

Return ONLY compact JSON (no prose, no markdown):
{
  "truthScore": <0-100 behavioral conviction>,
  "dealRisk": "<HEALTHY|CAUTION|AT_RISK|DEAD>",
  "urgency": "<NONE|LOW|MEDIUM|HIGH|CRITICAL>",
  "deception": {
    "hedgePct": <0-100>,
    "evasionPct": <0-100>,
    "stallProbability": <0-100>,
    "authorityDeflection": <0-100>,
    "timelineVagueness": <0-100>,
    "overEnthusiasm": <0-100>
  },
  "buyerIntentState": "<exploring|serious|stalling|using_as_leverage|ghosting|genuine_blocker|ready_to_buy|negotiating>",
  "ghostProbability": <0-100>,
  "negotiationPosture": {
    "powerScore": <0-100>,
    "commitmentScore": <0-100>,
    "leveragePosition": "<strong|neutral|weak>"
  },
  "competitiveRadar": {
    "competitorMentioned": <bool>,
    "competitors": ["<name>"],
    "competitiveRiskLevel": "<low|elevated|critical>"
  },
  "flags": [{"type":"<real_objection|fake_objection|stall|authority_evasion|budget_deflection|timeline_vague|competitive_mention|hedging>","severity":"<high|medium|low>","phrase":"<quote>"}],
  "suggestedReply": "<single sales reply ATOM could say next — short, 5-8 word bursts with // pauses, under 40 words, conversational>",
  "move": "<strategic move name>",
  "signal": "<what this reveals about the deal in one line>"
}`;

  const messages: any[] = [
    { role: "system", content: prompt },
    ...(dealContext ? [{ role: "user", content: `Deal context: ${dealContext.slice(0, 800)}` }] : []),
    { role: "user", content: `Thread so far:\n${thread.slice(-6).map(t => `${t.role.toUpperCase()}: ${t.text}`).join("\n")}\n\nAnalyze this latest prospect utterance: "${latestUtterance}"` },
  ];

  try {
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages,
        response_format: { type: "json_object" },
        temperature: 0.3,
        max_tokens: 900,
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) return null;
    const data: any = await r.json();
    return JSON.parse(data.choices[0].message.content);
  } catch {
    return null;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") return res.status(405).json({ error: "method" });

  // Accept either ?sessionId= (preferred) or ?callSid= (legacy)
  const sessionId = String(req.query.sessionId || req.query.callSid || "").trim();
  if (!sessionId) return res.status(400).json({ error: "sessionId required" });

  if (!HUME_API_KEY) return res.status(500).json({ error: "no HUME_API_KEY" });

  try {
    const chatId = await findChatBySessionId(sessionId);
    if (!chatId) {
      return res.status(200).json({
        sessionId,
        chatId: null,
        status: "pending",
        transcript: [],
        metrics: null,
        message: "chat not started yet",
      });
    }

    const events = await fetchChatEvents(chatId);

    // Transcript: role + text
    const transcript = events
      .filter(e => e.type === "USER_MESSAGE" || e.type === "AGENT_MESSAGE")
      .map(e => ({
        role: e.role === "USER" || e.type === "USER_MESSAGE" ? "user" : "agent",
        text: e.message_text || "",
        timestamp: e.timestamp,
      }))
      .filter(t => t.text);

    // Aggregate emotions from all USER_MESSAGE events
    const userEmotions: Record<string, number> = {};
    let emotionCount = 0;
    for (const e of events) {
      if (e.type === "USER_MESSAGE" && e.emotion_features) {
        try {
          const ef = JSON.parse(e.emotion_features) as Record<string, number>;
          for (const [k, v] of Object.entries(ef)) {
            userEmotions[k] = (userEmotions[k] || 0) + v;
          }
          emotionCount++;
        } catch {}
      }
    }

    // Average across messages
    const avgEmotions: Record<string, number> = {};
    for (const [k, v] of Object.entries(userEmotions)) {
      avgEmotions[k] = v / Math.max(1, emotionCount);
    }

    // Latest-message emotions (for near-real-time reactivity)
    let latestEmotions: Record<string, number> = {};
    for (let i = events.length - 1; i >= 0; i--) {
      const e = events[i];
      if (e.type === "USER_MESSAGE" && e.emotion_features) {
        try {
          latestEmotions = JSON.parse(e.emotion_features);
          break;
        } catch {}
      }
    }

    // We weight 70% latest / 30% running average for reactivity but smoothness.
    const blended: Record<string, number> = {};
    const allKeys = new Set([...Object.keys(avgEmotions), ...Object.keys(latestEmotions)]);
    for (const k of allKeys) {
      blended[k] = 0.7 * (latestEmotions[k] || 0) + 0.3 * (avgEmotions[k] || 0);
    }

    // Call-ended detection
    const endEvent = events.find(e => e.type === "CHAT_END_MESSAGE");

    // ─── Run Von Clausewitz / Aletheia on the last PROSPECT utterance ────────────
    // Only run when the prospect just spoke (not on every ATOM-only update).
    // This keeps us under ~1 OpenAI call per prospect utterance.
    const lastUserMsg = [...transcript].reverse().find(t => t.role === "user");
    const dealContext = String(req.query.dealContext || "");
    let warroom: any = null;
    if (lastUserMsg) {
      warroom = await runAletheia(lastUserMsg.text, transcript, dealContext);
    }

    const buyingSignals = extractBuyingSignals(transcript);

    return res.status(200).json({
      sessionId,
      chatId,
      status: endEvent ? "ended" : "active",
      endReason: endEvent?.end_reason || null,
      transcript,
      buyingSignals,                            // restored: chip list for UI
      metrics: {
        sentiment: computeSentiment(blended),   // -100..100
        buyerIntent: computeIntent(blended),    // 0..100
        emotions: rollupEmotions(blended),      // 6 group scores 0..1
        stage: inferStage(transcript),          // 1..4
        messageCount: transcript.length,
        emotionSampleCount: emotionCount,
      },
      warroom,                                  // von Clausewitz analysis
      rawEmotionsLatest: latestEmotions,
    });
  } catch (err: any) {
    console.error("chat-events error:", err);
    return res.status(500).json({ error: err?.message || "failed" });
  }
}
