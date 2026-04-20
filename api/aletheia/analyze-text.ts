/**
 * ATOM Aletheia — Text Deception Analysis (Vercel Pro)
 * GPT-4o constrained JSON for truth/deception scoring
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    return res.status(204).end();
  }
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  const { text, channel = "text", threadContext = [] } = req.body || {};
  if (!text || text.trim().length < 10) return res.status(400).json({ error: "Text too short" });

  try {
    const prompt = `You are ATOM Aletheia — an advanced deception intelligence engine for sales. Analyze this ${channel} message for truth signals.

Return ONLY valid JSON:
{"aletheiaTruthScore":<0-100>,"overallRisk":"<HIGH|MEDIUM|LOW|GHOST>","hedgePct":<0-100>,"evasionPct":<0-100>,"urgency":"<NONE|LOW|MEDIUM|HIGH|CRITICAL>","dealRisk":"<HEALTHY|CAUTION|AT_RISK|DEAD>","flags":[{"type":"<real_objection|fake_objection|stall|ghosting_pattern|authority_evasion|budget_deflection|timeline_vague|over_enthusiasm|distancing|hedging>","severity":"<high|medium|low>","phrase":"<exact phrase>","explanation":"<why suspicious>"}],"highlightedPhrases":[{"phrase":"<exact text>","color":"<red|amber|green>","reason":"<brief>"}],"linguisticCues":{"passiveVoice":<0-100>,"distancingLanguage":<0-100>,"overCertainty":<0-100>,"nonAnswerRatio":<0-100>,"fillerWords":<0-100>},"buyerIntentState":"<exploring|serious|stalling|using_as_leverage|ghosting|genuine_blocker>","ghostProbability":<0-100>,"suggestedReplies":["<reply 1>","<reply 2>","<reply 3>"],"playbook":{"move":"<move name>","tactic":"<tactic>","signal":"<what it reveals>"},"summary":"<2-3 sentence summary>"}

Analyze for: hedging, evasion, authority deflection, budget fabrication, distancing, over-enthusiasm, ghosting signals, timeline vagueness. Be brutally honest.`;

    const messages: any[] = [{ role: "system", content: prompt }];
    if (threadContext.length > 0) {
      messages.push({ role: "user", content: `Thread context:\n${threadContext.map((m: string, i: number) => `[${i+1}] ${m}`).join("\n")}\n\nAnalyze this latest message:` });
    }
    messages.push({ role: "user", content: text });

    const gptRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "gpt-4o-mini", messages, response_format: { type: "json_object" }, temperature: 0.3 }),
      signal: AbortSignal.timeout(15000),
    });
    if (!gptRes.ok) throw new Error(`GPT ${gptRes.status}`);
    const data = await gptRes.json();
    const analysis = JSON.parse(data.choices[0].message.content);
    return res.json({ ...analysis, channel, analyzedAt: new Date().toISOString(), engine: "aletheia-v1" });
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
}
