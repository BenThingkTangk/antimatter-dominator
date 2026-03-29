import type { VercelRequest, VercelResponse } from "@vercel/node";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const PRODUCTS: Record<string, any> = {
  "antimatter-ai": {
    name: "Antimatter AI Platform",
    desc: "Full-service AI dev, product design, healthcare apps, IoT, GTM strategy. 20+ projects, 100% satisfaction, 3-5x faster time-to-market.",
    edge: "AI-native from day one. Design + engineering + AI + GTM under one roof.",
    price: "Project-based, starting $25k",
    keyMetrics: ["20+ projects delivered", "100% client satisfaction", "3-5x faster time-to-market"],
    objections: ["We have an in-house team", "Too expensive", "We're not ready for AI"],
  },
  "atom-enterprise": {
    name: "ATOM Enterprise AI",
    desc: "Enterprise AI framework. Deploy voice/search/workflow agents in VPC, on-prem, or edge. Zero-training guarantee, full IP ownership, Akamai+Linode edge.",
    edge: "Framework not tool. Hard isolation. Zero-training. Beats Kore.ai, Copilot Studio.",
    price: "Enterprise licensing, custom quote",
    keyMetrics: ["Zero-training guarantee", "Full IP ownership", "VPC/on-prem/edge deployment"],
    objections: ["We already have AI infrastructure", "Too complex", "Compliance concerns"],
  },
  "vidzee": {
    name: "Vidzee",
    desc: "AI listing photos to cinematic real estate videos in 5 min. Save $200-500/video. 12,400+ videos by 2,800+ agents.",
    edge: "Replaces $500 videographer with 5-minute AI.",
    price: "From $49/month",
    keyMetrics: ["5 minutes per video", "Save $200-500/video", "12,400+ videos created"],
    objections: ["I already hire a videographer", "AI videos won't look professional", "My listings don't need video"],
  },
  "clinix-agent": {
    name: "Clinix Agent",
    desc: "AI billing/denial appeals for healthcare. Success-based pricing 0.6-1.2% paid claims.",
    edge: "Stedi rails + ML signals. Pay only on success.",
    price: "0.6-1.2% of paid claims (success-based)",
    keyMetrics: ["0.6-1.2% success-based pricing", "5-12% revenue recovery", "HIPAA-grade security"],
    objections: ["We have a billing team", "HIPAA compliance concerns", "Denial rate is manageable"],
  },
  "clinix-ai": {
    name: "Clinix AI",
    desc: "AI SOAP notes, ICD-10/CPT/DSM-5-TR coding. Cut documentation 70%. Save 2-3 hrs/day.",
    edge: "Clinical context understanding. Real-time coding + EHR integration.",
    price: "From $149/provider/month",
    keyMetrics: ["Cut documentation 70%", "Save 2-3 hrs/day", "ICD-10/CPT/DSM-5-TR coding"],
    objections: ["AI can't capture clinical nuance", "Comfortable with current workflow", "EHR integration nightmare"],
  },
  "red-team-atom": {
    name: "Red Team ATOM",
    desc: "Autonomous quantum-ready red team range. PQC engine, MITRE ATLAS heatmapping.",
    edge: "First quantum-ready red team. Continuous simulation vs annual pen tests.",
    price: "Enterprise licensing, starts $50k/year",
    keyMetrics: ["First quantum-ready platform", "PQC engine", "MITRE ATLAS compliance"],
    objections: ["Quantum threats are years away", "We do annual pen tests", "Too advanced"],
  },
};

const SYSTEM = `You generate realistic cold call transcripts. The AI agent is ATOM from Antimatter AI.

CRITICAL VOICE RULES — ATOM must sound like a REAL HUMAN on a phone call:
- Use 5-15 word sentences. Short. Punchy. Natural.
- Always use contractions: "I'm", "we've", "you'll", "that's", "it's", "don't"
- Include natural fillers sparingly: "yeah so", "honestly", "look", "I mean"
- Use backchannels every 2-3 turns: "gotcha", "I hear you", "that makes sense", "mm-hm", "right"
- NEVER say you are an AI. You are ATOM, a real person.
- NEVER use corporate jargon, buzzwords, or robotic phrasing.
- NEVER list more than 2 things in a row. Break into multiple turns.
- Sound like you're calling from a coffee shop, not reading a script.
- Match the prospect's energy — if they're casual, be casual. If serious, tone it down.
- When they push back, pause first, then acknowledge genuinely before redirecting.

EXAMPLE GOOD TURNS (learn this rhythm):
ATOM: "Hey Sarah, it's ATOM from Antimatter. Hope I'm not catching you at a bad time?"
ATOM: "Yeah so, quick reason for the call — I came across TechCorp and thought there might be a fit."
ATOM: "Gotcha. That's actually what a lot of our clients were dealing with before we started working together."
ATOM: "I hear you on that. Totally fair. The cool thing is we actually do success-based pricing, so there's no risk."
ATOM: "Would it make sense to grab fifteen minutes next week? I can show you exactly how it'd work for you guys."

EXAMPLE BAD TURNS (never do this):
"I'd like to present our comprehensive AI solution portfolio" ← too corporate
"Our platform offers end-to-end capabilities" ← robot speak
"Let me walk you through our value proposition" ← nobody talks like this

PRODUCT KNOWLEDGE:
- Antimatter AI Platform: Full-service AI dev, product design, healthcare apps, IoT, GTM. 20+ projects, 100% satisfaction.
- ATOM Enterprise AI: Deploy AI agents in VPC/on-prem/edge. Zero-training guarantee, full IP ownership. Akamai edge.
- Vidzee: Listing photos → cinematic videos in 5 min. Save $200-500/video. 12,400+ videos.
- Clinix Agent: AI billing/denial appeals. Success-based pricing. Stedi rails + ML.
- Clinix AI: AI SOAP notes, ICD-10/CPT coding. Cut docs 70%, save 2-3 hrs/day.
- Red Team ATOM: Quantum-ready red team. PQC engine, MITRE ATLAS heatmapping.

OBJECTION HANDLING (acknowledge first, then redirect):
1. Acknowledge genuinely: "Yeah, that's totally fair" / "I get that" / "Makes sense"
2. Reframe with a specific metric or story
3. Ask a question that moves forward

CALL FLOW: opener → discovery → value → objection → deepen → close for next step`;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { companyName, contactName, contactTitle, productSlug, companyContext } = req.body;
    const product = PRODUCTS[productSlug];
    if (!product) return res.status(404).json({ error: "Product not found" });

    const prompt = `Generate a realistic cold call simulation for ATOM calling ${contactName} (${contactTitle || "Decision Maker"}) at ${companyName}${companyContext ? ` (${companyContext})` : ""}.

Product being pitched: ${product.name}
Product description: ${product.desc}
Competitive edge: ${product.edge}
Pricing: ${product.price}
Key metrics: ${product.keyMetrics.join(", ")}
Common objections to handle: ${product.objections.join(", ")}

Generate a realistic 10-14 message cold call conversation that progresses through:
1. ATOM's warm opener (personal, hooks on company/role)
2. Contact's initial response (slightly guarded)
3. ATOM discovery question about pain/challenges
4. Contact sharing a real challenge
5. ATOM connecting challenge to product value
6. Contact raising an objection
7. ATOM handling objection with metrics
8. Contact showing interest/asking question
9. ATOM deepening value with proof
10. Contact asking about pricing/next steps
11. ATOM qualifying timeline/authority
12. Contact confirming interest
13. ATOM asking for the meeting/demo
14. Contact agreeing to next step

Return a JSON object with this exact structure (no markdown, no explanation, just pure JSON):
{
  "transcript": [
    { "speaker": "ATOM", "text": "opening message", "timestamp": 0 },
    { "speaker": "Contact", "text": "response", "timestamp": 12 }
  ],
  "sentimentTimeline": [
    { "time": 0, "score": 30 },
    { "time": 20, "score": 45 }
  ],
  "intentTimeline": [
    { "time": 0, "score": 10 },
    { "time": 20, "score": 25 }
  ],
  "emotionalTones": {
    "curious": 65,
    "interested": 72,
    "skeptical": 40,
    "frustrated": 15,
    "excited": 55,
    "neutral": 30
  },
  "qualification": {
    "qualified": true,
    "score": 78,
    "keySignals": ["Confirmed budget authority", "30-day evaluation timeline", "Active pain point"],
    "objections": ["Current vendor contract", "Team adoption concerns"]
  },
  "outcome": "qualified",
  "duration": 420,
  "aiRecommendations": [
    "Send demo link within 2 hours",
    "Include ROI calculator for their company size",
    "CC their VP of Engineering on follow-up"
  ]
}

Rules:
- transcript timestamps in seconds, starting at 0, incrementing 8-15 seconds per message
- sentimentTimeline: 5-8 data points, starts around 25-40, ends 60-85 for qualified calls. Times match key transcript moments.
- intentTimeline: 5-8 data points, starts around 10-20, ends 65-85 for qualified calls
- emotionalTones: all values 0-100
- outcome must be one of: "qualified", "follow-up", "no-interest", "callback"
- duration in seconds (150-600 range)
- Make the conversation sound authentic and natural for a B2B cold call
- ATOM should use the contact's name and company name in conversation`;

    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 4000,
      system: SYSTEM,
      messages: [{ role: "user", content: prompt }],
    });

    const rawContent = message.content[0].type === "text" ? message.content[0].text : "";

    // Parse the JSON response
    let parsed;
    try {
      // Strip potential markdown code blocks
      const cleaned = rawContent.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch (e) {
      // Try to extract JSON from the response
      const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("Failed to parse AI response as JSON");
      parsed = JSON.parse(jsonMatch[0]);
    }

    res.json(parsed);
  } catch (err: any) {
    console.error("ATOM simulate error:", err);
    res.status(500).json({ error: err.message || "Failed to simulate call" });
  }
}
