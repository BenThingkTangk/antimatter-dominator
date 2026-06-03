/**
 * worker.ts — the ATOM Content worker surface. These are the functions ATOM
 * Brain (or any orchestrator) calls. They wrap the engines + adapter and
 * persist results. Everything routes through here so the brand-voice lock and
 * live-numbers verification can never be bypassed.
 *
 *   createContentBrief()      → persist a project from a validated brief
 *   generateContentAsset()    → generate + voice-check + claim-check + persist
 *   verifyContentClaims()     → re-run claim verification on a generation
 *   scoreVoiceCompliance()    → re-run voice scoring on arbitrary text
 *   createDerivativeAssets()  → derive a new asset from an existing generation
 *   refineGeneration()        → tighten / executive / technical rewrite
 *   approveGeneration()       → write the approval log entry
 */
import { storage } from "../storage";
import { DEFAULT_VOICE_YAML } from "@shared/constants/atom-content";
import type {
  ContentBrief, ContentGeneration, ContentProject,
} from "@shared/schema";
import { getLiveNumbers, type LiveNumbersResult } from "./liveNumbersEngine";
import { checkVoice, type VoiceReport } from "./voiceChecker";
import { checkClaims, claimsToRows, type ClaimReport } from "./claimChecker";
import {
  generateContent, transformContent, type GenerationEnvelope, type ProviderName, type ProviderFallback,
} from "./generationAdapter";
import { CONTENT_TYPE_LABELS } from "./promptBuilder";
import { evaluatePublishGuard, PublishGuardError } from "./publishGuard";
import { GUARDED_APPROVAL_ACTIONS } from "@shared/constants/atom-content";

export interface EvidencePanel {
  provider: ProviderName;
  isDemo: boolean;
  liveNumbersUsed: GenerationEnvelope["live_numbers_used"];
  availableMetrics: LiveNumbersResult["metrics"];
  claims: ClaimReport["claims"];
  claimsNeedingVerification: ClaimReport["claimsNeedingVerification"];
  suggestedProofPoints: string[];
  riskFlags: string[];
  complianceWarnings: string[];
  ctaRecommendations: string[];
  voice: VoiceReport;
  claimReport: { score: number; summary: string };
  fallbackMessage: string | null;
  /** Set when a production provider failed and output degraded to demo. */
  providerFallback: ProviderFallback | null;
}

function activeVoiceYaml(): string {
  return storage.getActiveVoiceProfile()?.yamlContent || DEFAULT_VOICE_YAML;
}

export function createContentBrief(brief: ContentBrief): ContentProject {
  const now = new Date().toISOString();
  return storage.createContentProject({
    title: brief.title,
    contentType: brief.contentType,
    targetAudience: brief.targetAudience,
    funnelStage: brief.funnelStage,
    intensity: brief.intensity,
    status: "draft",
    createdBy: "operator",
    createdAt: now,
    updatedAt: now,
  });
}

export interface GenerateResult {
  project: ContentProject;
  generation: ContentGeneration;
  evidence: EvidencePanel;
}

export async function generateContentAsset(brief: ContentBrief, projectId?: number): Promise<GenerateResult> {
  const project = projectId
    ? storage.getContentProjectById(projectId) ?? createContentBrief(brief)
    : createContentBrief(brief);

  const voiceYaml = activeVoiceYaml();

  // 1) Pull live numbers (the only numbers the model may state as fact).
  const live = getLiveNumbers({
    sourceSystem: brief.sourceSystem,
    from: brief.sourceFrom,
    to: brief.sourceTo,
    allowDemoData: brief.allowDemoData,
  });

  // 2) Generate.
  const gen = await generateContent({
    brief,
    voiceYaml,
    usableMetrics: live.usable,
    suggestableMetrics: live.suggestable,
    hasUsable: live.hasUsable,
  });

  // 3) Voice + claim verification (server-side, authoritative — never trust
  //    the model's self-reported scores).
  const voice = checkVoice(gen.envelope.content, voiceYaml);
  const claimReport = checkClaims(gen.envelope.content, live);

  const evidence = buildEvidence(gen.provider, gen.isDemo, gen.envelope, live, voice, claimReport, gen.fallback);

  // 4) Persist.
  const now = new Date().toISOString();
  const generation = storage.createContentGeneration({
    projectId: project.id,
    promptInput: JSON.stringify(brief),
    generatedOutput: gen.envelope.content,
    voiceScore: voice.score,
    claimScore: claimReport.score,
    evidenceJson: JSON.stringify({ ...evidence, envelope: gen.envelope }),
    provider: gen.provider,
    status: "generated",
    createdAt: now,
  });
  storage.replaceContentClaims(generation.id, claimsToRows(generation.id, claimReport));
  storage.updateContentProject(project.id, { status: "generated", updatedAt: now });

  return { project, generation, evidence };
}

function buildEvidence(
  provider: ProviderName,
  isDemo: boolean,
  envelope: GenerationEnvelope,
  live: LiveNumbersResult,
  voice: VoiceReport,
  claimReport: ClaimReport,
  providerFallback: ProviderFallback | null = null,
): EvidencePanel {
  const suggestedProofPoints = live.usable
    .filter((m) => !envelope.live_numbers_used.some((u) => u.metric_key === m.metricKey))
    .slice(0, 4)
    .map((m) => `${m.metricLabel}: ${m.display} (${m.sourceSystem}, ${m.confidence})`);

  const ctaRecommendations = Array.from(
    new Set(
      [
        envelope.cta,
        "Book a live walkthrough.",
        "See the execution layer in action.",
        "Get a 30-day pipeline audit.",
      ].filter(Boolean),
    ),
  ).slice(0, 4);

  return {
    provider,
    isDemo,
    liveNumbersUsed: envelope.live_numbers_used,
    availableMetrics: live.metrics,
    claims: claimReport.claims,
    claimsNeedingVerification: claimReport.claimsNeedingVerification,
    suggestedProofPoints,
    riskFlags: Array.from(new Set([...claimReport.riskFlags, ...envelope.risk_flags])),
    complianceWarnings: claimReport.complianceWarnings,
    ctaRecommendations,
    voice,
    claimReport: { score: claimReport.score, summary: claimReport.summary },
    fallbackMessage: live.fallbackMessage,
    providerFallback,
  };
}

export function verifyContentClaims(generationId: number): { claimReport: ClaimReport } | null {
  const gen = storage.getContentGenerationById(generationId);
  if (!gen) return null;
  const brief = safeBrief(gen.promptInput);
  const live = getLiveNumbers({
    sourceSystem: brief?.sourceSystem,
    from: brief?.sourceFrom,
    to: brief?.sourceTo,
    allowDemoData: brief?.allowDemoData,
  });
  const claimReport = checkClaims(gen.generatedOutput, live);
  storage.replaceContentClaims(generationId, claimsToRows(generationId, claimReport));
  storage.updateContentGeneration(generationId, { claimScore: claimReport.score });
  return { claimReport };
}

export function scoreVoiceCompliance(text: string): VoiceReport {
  return checkVoice(text, activeVoiceYaml());
}

const DERIVATIVE_INSTRUCTIONS: Record<string, string> = {
  linkedin: "Rewrite the source asset as a single high-impact LinkedIn post: strong first line, short paragraphs, one core idea, founder/exec tone, end on a CTA or discussion prompt.",
  "x-thread": "Rewrite the source asset as a numbered X thread: a hook tweet, then 6-10 concise tweets (one idea each), ending on a CTA.",
  youtube: "Write a YouTube video description from the source asset: a 2-line hook, what the viewer learns, product context, a CTA, a Links placeholder, and a Hashtags placeholder.",
  launch: "Write an email launch announcement from the source asset: subject line, preview line, body, and CTA.",
  "seo-landing": "Extract a landing-page section from the source asset: headline, subhead, 3 benefit bullets, and a CTA.",
  "founder-pov": "Rewrite the source asset as a first-person founder POV post with one sharp thesis and a call to rethink the status quo.",
};

export async function createDerivativeAssets(generationId: number, derivativeType: string): Promise<GenerateResult | null> {
  const source = storage.getContentGenerationById(generationId);
  if (!source) return null;
  const sourceProject = storage.getContentProjectById(source.projectId);
  const brief = safeBrief(source.promptInput);
  const voiceYaml = activeVoiceYaml();
  const live = getLiveNumbers({
    sourceSystem: brief?.sourceSystem,
    from: brief?.sourceFrom,
    to: brief?.sourceTo,
    allowDemoData: brief?.allowDemoData,
  });

  const instruction =
    DERIVATIVE_INSTRUCTIONS[derivativeType] ||
    `Rewrite the source asset as a ${CONTENT_TYPE_LABELS[derivativeType] || derivativeType}.`;

  const out = await transformContent({
    instruction,
    sourceContent: source.generatedOutput,
    voiceYaml,
    usableMetrics: live.usable,
  });

  // New project for the derivative so it stands as its own asset.
  const now = new Date().toISOString();
  const title = `${sourceProject?.title || "Asset"} → ${CONTENT_TYPE_LABELS[derivativeType] || derivativeType}`;
  const project = storage.createContentProject({
    title,
    contentType: derivativeType,
    targetAudience: sourceProject?.targetAudience || brief?.targetAudience || "Revenue leaders",
    funnelStage: sourceProject?.funnelStage || brief?.funnelStage || "consideration",
    intensity: sourceProject?.intensity || brief?.intensity || "sharp",
    status: "generated",
    createdBy: "operator",
    createdAt: now,
    updatedAt: now,
  });

  const voice = checkVoice(out.content, voiceYaml);
  const claimReport = checkClaims(out.content, live);
  const envelope: GenerationEnvelope = {
    title,
    asset_type: CONTENT_TYPE_LABELS[derivativeType] || derivativeType,
    content: out.content,
    summary: `Derivative ${derivativeType} from generation #${generationId}.`,
    cta: "",
    live_numbers_used: live.usable.filter((m) => out.content.includes(m.display)).map((m) => ({ metric_key: m.metricKey, label: m.metricLabel, value: m.display, source: m.sourceSystem })),
    claims: claimReport.claims.map((c) => c.claimText),
    claims_needing_verification: claimReport.claimsNeedingVerification.map((c) => c.claimText),
    voice_compliance_notes: [voice.summary],
    risk_flags: claimReport.riskFlags,
    derivative_recommendations: [],
  };
  const evidence = buildEvidence(out.provider, out.isDemo, envelope, live, voice, claimReport, out.fallback);

  const generation = storage.createContentGeneration({
    projectId: project.id,
    promptInput: JSON.stringify({ ...(brief || {}), derivedFrom: generationId, derivativeType }),
    generatedOutput: out.content,
    voiceScore: voice.score,
    claimScore: claimReport.score,
    evidenceJson: JSON.stringify({ ...evidence, envelope }),
    provider: out.provider,
    status: "generated",
    createdAt: now,
  });
  storage.replaceContentClaims(generation.id, claimsToRows(generation.id, claimReport));

  return { project, generation, evidence };
}

const REFINE_INSTRUCTIONS: Record<string, string> = {
  tighten: "Tighten the tone: shorter sentences, remove filler, sharpen every line. Keep all verified numbers exactly as stated.",
  executive: "Make it more executive: lead harder with business impact, raise the conviction, cut technical detail to the essential. Keep all verified numbers exactly.",
  technical: "Make it more technical: add the operating-model and architecture detail an engineering or RevOps buyer needs, after the business framing. Keep all verified numbers exactly.",
};

export async function refineGeneration(generationId: number, mode: "tighten" | "executive" | "technical"): Promise<{ generation: ContentGeneration; evidence: EvidencePanel } | null> {
  const source = storage.getContentGenerationById(generationId);
  if (!source) return null;
  const brief = safeBrief(source.promptInput);
  const voiceYaml = activeVoiceYaml();
  const live = getLiveNumbers({
    sourceSystem: brief?.sourceSystem,
    from: brief?.sourceFrom,
    to: brief?.sourceTo,
    allowDemoData: brief?.allowDemoData,
  });

  const out = await transformContent({
    instruction: REFINE_INSTRUCTIONS[mode],
    sourceContent: source.generatedOutput,
    voiceYaml,
    usableMetrics: live.usable,
  });

  const voice = checkVoice(out.content, voiceYaml);
  const claimReport = checkClaims(out.content, live);
  const existingEnvelope = safeEnvelope(source.evidenceJson);
  const envelope: GenerationEnvelope = {
    ...(existingEnvelope || ({} as GenerationEnvelope)),
    content: out.content,
    title: existingEnvelope?.title || "Refined asset",
    asset_type: existingEnvelope?.asset_type || "",
    summary: existingEnvelope?.summary || "",
    cta: existingEnvelope?.cta || "",
    live_numbers_used: existingEnvelope?.live_numbers_used || [],
    claims: claimReport.claims.map((c) => c.claimText),
    claims_needing_verification: claimReport.claimsNeedingVerification.map((c) => c.claimText),
    voice_compliance_notes: [voice.summary],
    risk_flags: claimReport.riskFlags,
    derivative_recommendations: existingEnvelope?.derivative_recommendations || [],
  };
  const evidence = buildEvidence(out.provider, out.isDemo, envelope, live, voice, claimReport, out.fallback);

  const updated = storage.updateContentGeneration(generationId, {
    generatedOutput: out.content,
    voiceScore: voice.score,
    claimScore: claimReport.score,
    evidenceJson: JSON.stringify({ ...evidence, envelope }),
    provider: out.provider,
    status: "revised",
  });
  storage.replaceContentClaims(generationId, claimsToRows(generationId, claimReport));
  return updated ? { generation: updated, evidence } : null;
}

/**
 * Persist an operator's inline edit and re-score it. Result-page edits used to
 * be local-only React state, so refine / derive / approve / export operated on
 * the stale stored output, not what the operator saw. Routing edits through here
 * makes the edited text authoritative and re-runs voice + claim verification so
 * the scores and evidence reflect the actual content being acted on.
 */
export function saveEditedGeneration(generationId: number, editedContent: string): { generation: ContentGeneration; evidence: EvidencePanel } | null {
  const source = storage.getContentGenerationById(generationId);
  if (!source) return null;
  const brief = safeBrief(source.promptInput);
  const voiceYaml = activeVoiceYaml();
  const live = getLiveNumbers({
    sourceSystem: brief?.sourceSystem,
    from: brief?.sourceFrom,
    to: brief?.sourceTo,
    allowDemoData: brief?.allowDemoData,
  });

  const voice = checkVoice(editedContent, voiceYaml);
  const claimReport = checkClaims(editedContent, live);
  const existingEnvelope = safeEnvelope(source.evidenceJson);
  const envelope: GenerationEnvelope = {
    ...(existingEnvelope || ({} as GenerationEnvelope)),
    content: editedContent,
    title: existingEnvelope?.title || "Edited asset",
    asset_type: existingEnvelope?.asset_type || "",
    summary: existingEnvelope?.summary || "",
    cta: existingEnvelope?.cta || "",
    live_numbers_used: (existingEnvelope?.live_numbers_used || []).filter((u) => editedContent.includes(u.value)),
    claims: claimReport.claims.map((c) => c.claimText),
    claims_needing_verification: claimReport.claimsNeedingVerification.map((c) => c.claimText),
    voice_compliance_notes: [voice.summary],
    risk_flags: claimReport.riskFlags,
    derivative_recommendations: existingEnvelope?.derivative_recommendations || [],
  };
  const isDemo = existingEnvelope ? (safeEvidenceIsDemo(source.evidenceJson) ?? false) : false;
  const evidence = buildEvidence(source.provider as ProviderName, isDemo, envelope, live, voice, claimReport);

  const updated = storage.updateContentGeneration(generationId, {
    generatedOutput: editedContent,
    voiceScore: voice.score,
    claimScore: claimReport.score,
    evidenceJson: JSON.stringify({ ...evidence, envelope }),
    status: "revised",
  });
  storage.replaceContentClaims(generationId, claimsToRows(generationId, claimReport));
  return updated ? { generation: updated, evidence } : null;
}

export function approveGeneration(generationId: number, action: "approved" | "revised" | "rejected" | "exported", notes?: string) {
  const gen = storage.getContentGenerationById(generationId);
  if (!gen) return null;

  // Server-side publish guard: approving or exporting promotes the asset to a
  // published/ready state, so it must pass the claim-safety gate regardless of
  // what the UI allowed. Throws PublishGuardError (HTTP 422) when blocked.
  if (GUARDED_APPROVAL_ACTIONS.includes(action)) {
    const result = evaluatePublishGuard(action, gen.claimScore, storage.getContentClaims(generationId));
    if (!result.ok) throw new PublishGuardError(result);
  }

  const project = storage.getContentProjectById(gen.projectId);
  const date = new Date().toISOString().slice(0, 10);
  const typeLabel = project ? CONTENT_TYPE_LABELS[project.contentType] || project.contentType : "asset";
  const outcomeByAction: Record<string, string> = {
    approved: `Approved ${typeLabel} "${project?.title || gen.id}" — ready for publishing`,
    revised: `Sent ${typeLabel} "${project?.title || gen.id}" back for revision`,
    rejected: `Rejected ${typeLabel} "${project?.title || gen.id}"`,
    exported: `Exported ${typeLabel} "${project?.title || gen.id}"`,
  };
  const outcome = `${date} ${action[0].toUpperCase()}${action.slice(1)} — ${outcomeByAction[action]}`;
  const entry = storage.createApprovalLogEntry({
    generationId,
    action,
    outcome,
    approvedBy: "operator",
    notes: notes || null,
    createdAt: new Date().toISOString(),
  });
  if (action === "approved") {
    storage.updateContentGeneration(generationId, { status: "approved" });
    if (project) storage.updateContentProject(project.id, { status: "approved", updatedAt: new Date().toISOString() });
  }
  if (action === "exported") {
    storage.updateContentGeneration(generationId, { status: "exported" });
  }
  return entry;
}

function safeBrief(json: string): ContentBrief | null {
  try { return JSON.parse(json) as ContentBrief; } catch { return null; }
}
function safeEnvelope(json: string): GenerationEnvelope | null {
  try { const e = JSON.parse(json); return e.envelope || null; } catch { return null; }
}
function safeEvidenceIsDemo(json: string): boolean | null {
  try { const e = JSON.parse(json); return typeof e.isDemo === "boolean" ? e.isDemo : null; } catch { return null; }
}
