/**
 * ATOM Content API routes. Mounted under /api/content by registerContentRoutes.
 * Secrets stay server-side; metric provenance is returned to the operator's
 * own session (it is theirs to export).
 */
import type { Express } from "express";
import { storage } from "../storage";
import {
  contentBriefSchema, derivativeRequestSchema, refineRequestSchema, approveRequestSchema,
} from "@shared/schema";
import { parseVoiceYaml, DEFAULT_VOICE_YAML } from "@shared/constants/atom-content";
import { getLiveNumbers } from "./liveNumbersEngine";
import {
  createContentBrief, generateContentAsset, verifyContentClaims, scoreVoiceCompliance,
  createDerivativeAssets, refineGeneration, approveGeneration,
} from "./worker";
import { z } from "zod";

export function registerContentRoutes(app: Express) {
  // ── Dashboard summary
  app.get("/api/content/summary", (_req, res) => {
    const projects = storage.getContentProjects();
    const generations = storage.getContentGenerations();
    const activeVoice = storage.getActiveVoiceProfile();
    const live = getLiveNumbers({ allowDemoData: true });
    const recent = generations.slice(0, 8).map((g) => {
      const p = storage.getContentProjectById(g.projectId);
      return {
        id: g.id, projectId: g.projectId, title: p?.title || "Untitled",
        contentType: p?.contentType || "", voiceScore: g.voiceScore, claimScore: g.claimScore,
        status: g.status, provider: g.provider, createdAt: g.createdAt,
      };
    });
    res.json({
      projectCount: projects.length,
      generationCount: generations.length,
      approvedCount: generations.filter((g) => g.status === "approved").length,
      voiceProfile: activeVoice ? { id: activeVoice.id, name: activeVoice.name } : null,
      metrics: {
        usable: live.usable.length,
        suggestable: live.suggestable.length,
        total: live.metrics.length,
        demoCount: live.metrics.filter((m) => m.isDemo).length,
      },
      recent,
    });
  });

  // ── Projects + generations
  app.get("/api/content/projects", (_req, res) => {
    const projects = storage.getContentProjects().map((p) => ({
      ...p,
      generations: storage.getContentGenerations(p.id).length,
    }));
    res.json(projects);
  });

  app.get("/api/content/generations", (req, res) => {
    const projectId = req.query.projectId ? Number(req.query.projectId) : undefined;
    res.json(storage.getContentGenerations(projectId));
  });

  app.get("/api/content/generations/:id", (req, res) => {
    const g = storage.getContentGenerationById(Number(req.params.id));
    if (!g) return res.status(404).json({ error: "Generation not found" });
    const project = storage.getContentProjectById(g.projectId);
    let evidence: any = null;
    try { evidence = JSON.parse(g.evidenceJson); } catch {}
    res.json({ generation: g, project, evidence, claims: storage.getContentClaims(g.id) });
  });

  // ── Generate
  app.post("/api/content/generate", async (req, res) => {
    try {
      const brief = contentBriefSchema.parse(req.body);
      const result = await generateContentAsset(brief);
      res.json(result);
    } catch (err: any) {
      console.error("content/generate error:", err);
      res.status(err?.issues ? 400 : 500).json({ error: err.message || "Generation failed" });
    }
  });

  app.post("/api/content/brief", (req, res) => {
    try {
      const brief = contentBriefSchema.parse(req.body);
      res.json(createContentBrief(brief));
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // ── Derivatives + refine
  app.post("/api/content/derivative", async (req, res) => {
    try {
      const { generationId, derivativeType } = derivativeRequestSchema.parse(req.body);
      const result = await createDerivativeAssets(generationId, derivativeType);
      if (!result) return res.status(404).json({ error: "Source generation not found" });
      res.json(result);
    } catch (err: any) {
      res.status(err?.issues ? 400 : 500).json({ error: err.message });
    }
  });

  app.post("/api/content/refine", async (req, res) => {
    try {
      const { generationId, mode } = refineRequestSchema.parse(req.body);
      const result = await refineGeneration(generationId, mode);
      if (!result) return res.status(404).json({ error: "Generation not found" });
      res.json(result);
    } catch (err: any) {
      res.status(err?.issues ? 400 : 500).json({ error: err.message });
    }
  });

  // ── Verify + voice score
  app.post("/api/content/generations/:id/verify", (req, res) => {
    const result = verifyContentClaims(Number(req.params.id));
    if (!result) return res.status(404).json({ error: "Generation not found" });
    res.json(result);
  });

  app.post("/api/content/voice/score", (req, res) => {
    try {
      const { text } = z.object({ text: z.string().min(1) }).parse(req.body);
      res.json(scoreVoiceCompliance(text));
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // ── Live numbers
  app.get("/api/content/live-numbers", (req, res) => {
    const result = getLiveNumbers({
      sourceSystem: (req.query.sourceSystem as string) || undefined,
      from: (req.query.from as string) || undefined,
      to: (req.query.to as string) || undefined,
      allowDemoData: req.query.allowDemoData === "true",
    });
    res.json(result);
  });

  // ── Voice profiles
  app.get("/api/content/voice-profiles", (_req, res) => {
    res.json(storage.getVoiceProfiles());
  });

  app.get("/api/content/voice-profiles/active", (_req, res) => {
    const active = storage.getActiveVoiceProfile();
    const yaml = active?.yamlContent || DEFAULT_VOICE_YAML;
    res.json({ profile: active, parsed: parseVoiceYaml(yaml) });
  });

  app.post("/api/content/voice-profiles", (req, res) => {
    try {
      const { name, yamlContent } = z.object({ name: z.string().min(1), yamlContent: z.string().min(1) }).parse(req.body);
      // Validate it parses before saving.
      parseVoiceYaml(yamlContent);
      const now = new Date().toISOString();
      const created = storage.createVoiceProfile({ name, yamlContent, active: false, createdAt: now, updatedAt: now });
      res.json(created);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.patch("/api/content/voice-profiles/:id", (req, res) => {
    try {
      const id = Number(req.params.id);
      const body = z.object({ name: z.string().optional(), yamlContent: z.string().optional(), setActive: z.boolean().optional() }).parse(req.body);
      if (body.yamlContent) parseVoiceYaml(body.yamlContent);
      const patch: any = { updatedAt: new Date().toISOString() };
      if (body.name) patch.name = body.name;
      if (body.yamlContent) patch.yamlContent = body.yamlContent;
      const updated = storage.updateVoiceProfile(id, patch);
      if (!updated) return res.status(404).json({ error: "Profile not found" });
      if (body.setActive) storage.setActiveVoiceProfile(id);
      res.json(storage.getVoiceProfiles().find((p) => p.id === id));
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // ── Claims review (across recent generations)
  app.get("/api/content/claims", (req, res) => {
    const generationId = req.query.generationId ? Number(req.query.generationId) : undefined;
    if (generationId) return res.json(storage.getContentClaims(generationId));
    // Aggregate recent risky claims across the latest generations.
    const gens = storage.getContentGenerations().slice(0, 25);
    const all = gens.flatMap((g) =>
      storage.getContentClaims(g.id).map((c) => ({ ...c, generationStatus: g.status })),
    );
    res.json(all);
  });

  // ── Approval log + approve action
  app.get("/api/content/approval-log", (req, res) => {
    const generationId = req.query.generationId ? Number(req.query.generationId) : undefined;
    res.json(storage.getApprovalLog(generationId));
  });

  app.post("/api/content/approve", (req, res) => {
    try {
      const { generationId, action, notes } = approveRequestSchema.parse(req.body);
      const entry = approveGeneration(generationId, action, notes);
      if (!entry) return res.status(404).json({ error: "Generation not found" });
      res.json(entry);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });
}
