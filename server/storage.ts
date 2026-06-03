import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import { eq, desc, sql } from "drizzle-orm";
import {
  products, pitches, objections, prospects, marketIntel,
  campaigns, campaignAccounts, scoringTemplates,
  contentProjects, contentGenerations, voiceProfiles,
  productActivityMetrics, productActivityEvents, contentClaims, approvalLog,
  type Product, type InsertProduct,
  type Pitch, type InsertPitch,
  type Objection, type InsertObjection,
  type Prospect, type InsertProspect,
  type MarketIntel, type InsertMarketIntel,
  type Campaign, type InsertCampaign,
  type CampaignAccount, type InsertCampaignAccount,
  type ScoringTemplate, type InsertScoringTemplate,
  type ContentProject, type InsertContentProject,
  type ContentGeneration, type InsertContentGeneration,
  type VoiceProfile, type InsertVoiceProfile,
  type ProductActivityMetric, type InsertProductActivityMetric,
  type ProductActivityEvent, type InsertProductActivityEvent,
  type ContentClaim, type InsertContentClaim,
  type ApprovalLogEntry, type InsertApprovalLogEntry,
} from "@shared/schema";
import { DEFAULT_VOICE_YAML } from "@shared/constants/atom-content";

const sqlite = new Database("antimatter.db");
sqlite.pragma("journal_mode = WAL");

export const db = drizzle(sqlite);

// Create tables
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    tagline TEXT NOT NULL,
    description TEXT NOT NULL,
    url TEXT NOT NULL,
    category TEXT NOT NULL,
    target_market TEXT NOT NULL,
    key_features TEXT NOT NULL,
    value_props TEXT NOT NULL,
    common_objections TEXT NOT NULL,
    competitive_edge TEXT NOT NULL,
    icon TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS pitches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL,
    pitch_type TEXT NOT NULL,
    target_persona TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS objections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL,
    objection TEXT NOT NULL,
    response TEXT NOT NULL,
    category TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS prospects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company_name TEXT NOT NULL,
    industry TEXT NOT NULL,
    score REAL NOT NULL,
    reason TEXT NOT NULL,
    matched_products TEXT NOT NULL,
    signals TEXT NOT NULL,
    company_size TEXT NOT NULL,
    urgency TEXT NOT NULL,
    last_updated TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'new'
  );

  CREATE TABLE IF NOT EXISTS market_intel (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    summary TEXT NOT NULL,
    relevant_products TEXT NOT NULL,
    impact_level TEXT NOT NULL,
    source TEXT NOT NULL,
    category TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS scoring_templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    weights_json TEXT NOT NULL,
    sub_vertical_profile_json TEXT NOT NULL,
    revenue_tiers_json TEXT NOT NULL,
    akafit_multipliers_json TEXT NOT NULL,
    wallet_multipliers_json TEXT NOT NULL,
    segmentation_fit_json TEXT NOT NULL,
    tier_thresholds_json TEXT NOT NULL,
    why_now_template TEXT NOT NULL,
    recommended_move_json TEXT NOT NULL,
    is_system INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS campaigns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    product_slug TEXT NOT NULL,
    product_label TEXT NOT NULL,
    scoring_template_slug TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft',
    total_accounts INTEGER NOT NULL DEFAULT 0,
    scored_accounts INTEGER NOT NULL DEFAULT 0,
    enriched_accounts INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS campaign_accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    campaign_id INTEGER NOT NULL,
    account_name TEXT NOT NULL,
    domain TEXT,
    state TEXT,
    sub_vertical TEXT,
    revenue REAL,
    akafit TEXT,
    wallet_grade TEXT,
    extra_tags_json TEXT,
    score_regulatory REAL DEFAULT 0,
    score_breach REAL DEFAULT 0,
    score_account_fit REAL DEFAULT 0,
    score_segmentation REAL DEFAULT 0,
    score_list_density REAL DEFAULT 0,
    score_atom_intent REAL DEFAULT 0,
    score_atom_personas REAL DEFAULT 0,
    score_atom_freshness REAL DEFAULT 0,
    public_subtotal REAL DEFAULT 0,
    final_score REAL DEFAULT 0,
    tier TEXT,
    why_now TEXT,
    recommended_move TEXT,
    atom_enriched_at TEXT,
    atom_pain_points_json TEXT,
    atom_buying_signals_json TEXT,
    atom_recent_news_json TEXT,
    atom_tech_stack_json TEXT,
    atom_decision_makers_json TEXT,
    direct_breach_json TEXT,
    peer_breach_json TEXT,
    enrich_status TEXT NOT NULL DEFAULT 'pending',
    enrich_error TEXT,
    pushed_to TEXT,
    created_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_campaign_accounts_campaign_id ON campaign_accounts(campaign_id);
  CREATE INDEX IF NOT EXISTS idx_campaign_accounts_final_score ON campaign_accounts(final_score DESC);

  -- ── ATOM CONTENT WORKER ────────────────────────────────────────────────
  CREATE TABLE IF NOT EXISTS content_projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    content_type TEXT NOT NULL,
    target_audience TEXT NOT NULL,
    funnel_stage TEXT NOT NULL,
    intensity TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft',
    created_by TEXT NOT NULL DEFAULT 'operator',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS content_generations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    prompt_input TEXT NOT NULL,
    generated_output TEXT NOT NULL,
    voice_score REAL NOT NULL DEFAULT 0,
    claim_score REAL NOT NULL DEFAULT 0,
    evidence_json TEXT NOT NULL,
    provider TEXT NOT NULL DEFAULT 'demo',
    status TEXT NOT NULL DEFAULT 'generated',
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS voice_profiles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    yaml_content TEXT NOT NULL,
    active INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS product_activity_metrics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    metric_key TEXT NOT NULL,
    metric_label TEXT NOT NULL,
    metric_value REAL NOT NULL,
    unit TEXT NOT NULL DEFAULT '',
    source_system TEXT NOT NULL,
    source_record_id TEXT,
    confidence TEXT NOT NULL DEFAULT 'unverified',
    is_demo INTEGER NOT NULL DEFAULT 0,
    captured_at TEXT NOT NULL,
    metadata_json TEXT
  );

  CREATE TABLE IF NOT EXISTS product_activity_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_type TEXT NOT NULL,
    source_system TEXT NOT NULL,
    source_record_id TEXT,
    occurred_at TEXT NOT NULL,
    tenant_id TEXT,
    user_id TEXT,
    prospect_id TEXT,
    account_id TEXT,
    campaign_id TEXT,
    is_demo INTEGER NOT NULL DEFAULT 0,
    metadata_json TEXT,
    created_at TEXT NOT NULL
  );

  -- Natural-key uniqueness for idempotent ingestion: a (source_system,
  -- source_record_id) pair is inserted at most once. Rows with a NULL
  -- source_record_id are not deduped (SQLite treats NULLs as distinct).
  CREATE UNIQUE INDEX IF NOT EXISTS idx_pae_natural_key
    ON product_activity_events(source_system, source_record_id);
  CREATE INDEX IF NOT EXISTS idx_pae_type_time ON product_activity_events(event_type, occurred_at);

  CREATE TABLE IF NOT EXISTS content_claims (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    generation_id INTEGER NOT NULL,
    claim_text TEXT NOT NULL,
    claim_type TEXT NOT NULL,
    metric_key TEXT,
    verified TEXT NOT NULL DEFAULT 'needs_review',
    source_system TEXT,
    confidence TEXT,
    risk_level TEXT NOT NULL DEFAULT 'low',
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS approval_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    generation_id INTEGER NOT NULL,
    action TEXT NOT NULL,
    outcome TEXT NOT NULL,
    approved_by TEXT NOT NULL DEFAULT 'operator',
    notes TEXT,
    created_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_content_generations_project ON content_generations(project_id);
  CREATE INDEX IF NOT EXISTS idx_content_claims_generation ON content_claims(generation_id);
  CREATE INDEX IF NOT EXISTS idx_approval_log_generation ON approval_log(generation_id);
  CREATE INDEX IF NOT EXISTS idx_pam_source ON product_activity_metrics(source_system);
`);

export interface IStorage {
  // Products
  getProducts(): Product[];
  getProductBySlug(slug: string): Product | undefined;
  getProductById(id: number): Product | undefined;
  createProduct(data: InsertProduct): Product;
  
  // Pitches
  getPitches(productId?: number): Pitch[];
  createPitch(data: InsertPitch): Pitch;
  
  // Objections
  getObjections(productId?: number): Objection[];
  createObjection(data: InsertObjection): Objection;
  
  // Prospects
  getProspects(): Prospect[];
  createProspect(data: InsertProspect): Prospect;
  updateProspectStatus(id: number, status: string): Prospect | undefined;
  
  // Market Intel
  getMarketIntel(): MarketIntel[];
  createMarketIntel(data: InsertMarketIntel): MarketIntel;

  // Campaigns
  getCampaigns(): Campaign[];
  getCampaignById(id: number): Campaign | undefined;
  createCampaign(data: InsertCampaign): Campaign;
  updateCampaign(id: number, patch: Partial<InsertCampaign>): Campaign | undefined;
  deleteCampaign(id: number): void;

  // Campaign Accounts
  getCampaignAccounts(campaignId: number, opts?: { tier?: string; limit?: number; offset?: number }): CampaignAccount[];
  getCampaignAccountById(id: number): CampaignAccount | undefined;
  bulkInsertCampaignAccounts(rows: InsertCampaignAccount[]): number;
  updateCampaignAccount(id: number, patch: Partial<InsertCampaignAccount>): CampaignAccount | undefined;
  bulkUpdateCampaignAccountScores(updates: Array<{ id: number } & Partial<InsertCampaignAccount>>): void;
  countCampaignAccountsByStatus(campaignId: number): { total: number; scored: number; enriched: number };

  // Scoring Templates
  getScoringTemplates(): ScoringTemplate[];
  getScoringTemplateBySlug(slug: string): ScoringTemplate | undefined;
  createScoringTemplate(data: InsertScoringTemplate): ScoringTemplate;

  // ── ATOM Content
  getContentProjects(): ContentProject[];
  getContentProjectById(id: number): ContentProject | undefined;
  createContentProject(data: InsertContentProject): ContentProject;
  updateContentProject(id: number, patch: Partial<InsertContentProject>): ContentProject | undefined;

  getContentGenerations(projectId?: number): ContentGeneration[];
  getContentGenerationById(id: number): ContentGeneration | undefined;
  createContentGeneration(data: InsertContentGeneration): ContentGeneration;
  updateContentGeneration(id: number, patch: Partial<InsertContentGeneration>): ContentGeneration | undefined;

  getVoiceProfiles(): VoiceProfile[];
  getActiveVoiceProfile(): VoiceProfile | undefined;
  createVoiceProfile(data: InsertVoiceProfile): VoiceProfile;
  updateVoiceProfile(id: number, patch: Partial<InsertVoiceProfile>): VoiceProfile | undefined;
  setActiveVoiceProfile(id: number): void;

  getProductActivityMetrics(opts?: { sourceSystem?: string; from?: string; to?: string; includeDemo?: boolean }): ProductActivityMetric[];
  createProductActivityMetric(data: InsertProductActivityMetric): ProductActivityMetric;
  /**
   * Insert-or-replace a PRODUCTION metric identified by (metricKey, sourceSystem,
   * sourceRecordId). Demo rows (isDemo=1) are never touched or matched, so a
   * re-ingest can never overwrite or promote seeded demo metrics. Returns the row.
   */
  upsertProductionMetric(data: InsertProductActivityMetric): ProductActivityMetric;

  // ── Product activity events (first-class production event feed)
  getProductActivityEvents(opts?: {
    eventType?: string; sourceSystem?: string; from?: string; to?: string; includeDemo?: boolean; limit?: number;
  }): ProductActivityEvent[];
  /**
   * Insert events idempotently on (sourceSystem, sourceRecordId). A repeat of an
   * already-seen event is skipped (not duplicated). Events with a null
   * sourceRecordId are always inserted (no dedupe key). Returns the counts.
   */
  insertProductActivityEvents(rows: InsertProductActivityEvent[]): { inserted: number; skipped: number };
  /** Count events grouped by event_type within an optional window/source. */
  countProductActivityEventsByType(opts?: {
    sourceSystem?: string; from?: string; to?: string; includeDemo?: boolean;
  }): Record<string, number>;

  getContentClaims(generationId: number): ContentClaim[];
  replaceContentClaims(generationId: number, rows: InsertContentClaim[]): void;

  getApprovalLog(generationId?: number): ApprovalLogEntry[];
  createApprovalLogEntry(data: InsertApprovalLogEntry): ApprovalLogEntry;
}

export class DatabaseStorage implements IStorage {
  getProducts(): Product[] {
    return db.select().from(products).all();
  }

  getProductBySlug(slug: string): Product | undefined {
    return db.select().from(products).where(eq(products.slug, slug)).get();
  }

  getProductById(id: number): Product | undefined {
    return db.select().from(products).where(eq(products.id, id)).get();
  }

  createProduct(data: InsertProduct): Product {
    return db.insert(products).values(data).returning().get();
  }

  getPitches(productId?: number): Pitch[] {
    if (productId) {
      return db.select().from(pitches).where(eq(pitches.productId, productId)).orderBy(desc(pitches.id)).all();
    }
    return db.select().from(pitches).orderBy(desc(pitches.id)).all();
  }

  createPitch(data: InsertPitch): Pitch {
    return db.insert(pitches).values(data).returning().get();
  }

  getObjections(productId?: number): Objection[] {
    if (productId) {
      return db.select().from(objections).where(eq(objections.productId, productId)).orderBy(desc(objections.id)).all();
    }
    return db.select().from(objections).orderBy(desc(objections.id)).all();
  }

  createObjection(data: InsertObjection): Objection {
    return db.insert(objections).values(data).returning().get();
  }

  getProspects(): Prospect[] {
    return db.select().from(prospects).orderBy(desc(prospects.score)).all();
  }

  createProspect(data: InsertProspect): Prospect {
    return db.insert(prospects).values(data).returning().get();
  }

  updateProspectStatus(id: number, status: string): Prospect | undefined {
    return db.update(prospects).set({ status }).where(eq(prospects.id, id)).returning().get();
  }

  getMarketIntel(): MarketIntel[] {
    return db.select().from(marketIntel).orderBy(desc(marketIntel.id)).all();
  }

  createMarketIntel(data: InsertMarketIntel): MarketIntel {
    return db.insert(marketIntel).values(data).returning().get();
  }

  // ── Campaigns
  getCampaigns(): Campaign[] {
    return db.select().from(campaigns).orderBy(desc(campaigns.id)).all();
  }

  getCampaignById(id: number): Campaign | undefined {
    return db.select().from(campaigns).where(eq(campaigns.id, id)).get();
  }

  createCampaign(data: InsertCampaign): Campaign {
    return db.insert(campaigns).values(data).returning().get();
  }

  updateCampaign(id: number, patch: Partial<InsertCampaign>): Campaign | undefined {
    return db.update(campaigns).set(patch).where(eq(campaigns.id, id)).returning().get();
  }

  deleteCampaign(id: number): void {
    db.delete(campaignAccounts).where(eq(campaignAccounts.campaignId, id)).run();
    db.delete(campaigns).where(eq(campaigns.id, id)).run();
  }

  // ── Campaign Accounts
  getCampaignAccounts(campaignId: number, opts?: { tier?: string; limit?: number; offset?: number }): CampaignAccount[] {
    let q: any = db.select().from(campaignAccounts).where(eq(campaignAccounts.campaignId, campaignId));
    if (opts?.tier) {
      q = db.select().from(campaignAccounts).where(
        sql`${campaignAccounts.campaignId} = ${campaignId} AND ${campaignAccounts.tier} = ${opts.tier}`
      );
    }
    q = q.orderBy(desc(campaignAccounts.finalScore));
    if (opts?.limit) q = q.limit(opts.limit);
    if (opts?.offset) q = q.offset(opts.offset);
    return q.all();
  }

  getCampaignAccountById(id: number): CampaignAccount | undefined {
    return db.select().from(campaignAccounts).where(eq(campaignAccounts.id, id)).get();
  }

  bulkInsertCampaignAccounts(rows: InsertCampaignAccount[]): number {
    if (rows.length === 0) return 0;
    // Use raw transaction for speed on large imports (up to 5000 rows).
    const insert = sqlite.prepare(`
      INSERT INTO campaign_accounts
      (campaign_id, account_name, domain, state, sub_vertical, revenue, akafit, wallet_grade,
       extra_tags_json, enrich_status, created_at)
      VALUES (@campaignId, @accountName, @domain, @state, @subVertical, @revenue, @akafit, @walletGrade,
              @extraTagsJson, @enrichStatus, @createdAt)
    `);
    const tx = sqlite.transaction((items: InsertCampaignAccount[]) => {
      for (const r of items) {
        insert.run({
          campaignId: r.campaignId,
          accountName: r.accountName,
          domain: r.domain ?? null,
          state: r.state ?? null,
          subVertical: r.subVertical ?? null,
          revenue: r.revenue ?? null,
          akafit: r.akafit ?? null,
          walletGrade: r.walletGrade ?? null,
          extraTagsJson: r.extraTagsJson ?? null,
          enrichStatus: r.enrichStatus ?? "pending",
          createdAt: r.createdAt,
        });
      }
    });
    tx(rows);
    return rows.length;
  }

  updateCampaignAccount(id: number, patch: Partial<InsertCampaignAccount>): CampaignAccount | undefined {
    return db.update(campaignAccounts).set(patch as any).where(eq(campaignAccounts.id, id)).returning().get();
  }

  bulkUpdateCampaignAccountScores(updates: Array<{ id: number } & Partial<InsertCampaignAccount>>): void {
    const tx = sqlite.transaction((items: any[]) => {
      for (const u of items) {
        const { id, ...patch } = u;
        db.update(campaignAccounts).set(patch).where(eq(campaignAccounts.id, id)).run();
      }
    });
    tx(updates);
  }

  countCampaignAccountsByStatus(campaignId: number): { total: number; scored: number; enriched: number } {
    const total = (db.select({ c: sql<number>`count(*)` }).from(campaignAccounts).where(eq(campaignAccounts.campaignId, campaignId)).get() as any)?.c ?? 0;
    const scored = (db.select({ c: sql<number>`count(*)` }).from(campaignAccounts).where(sql`${campaignAccounts.campaignId} = ${campaignId} AND ${campaignAccounts.publicSubtotal} > 0`).get() as any)?.c ?? 0;
    const enriched = (db.select({ c: sql<number>`count(*)` }).from(campaignAccounts).where(sql`${campaignAccounts.campaignId} = ${campaignId} AND ${campaignAccounts.enrichStatus} = 'done'`).get() as any)?.c ?? 0;
    return { total, scored, enriched };
  }

  // ── Scoring Templates
  getScoringTemplates(): ScoringTemplate[] {
    return db.select().from(scoringTemplates).orderBy(desc(scoringTemplates.id)).all();
  }

  getScoringTemplateBySlug(slug: string): ScoringTemplate | undefined {
    return db.select().from(scoringTemplates).where(eq(scoringTemplates.slug, slug)).get();
  }

  createScoringTemplate(data: InsertScoringTemplate): ScoringTemplate {
    return db.insert(scoringTemplates).values(data).returning().get();
  }

  // ── ATOM Content: Projects
  getContentProjects(): ContentProject[] {
    return db.select().from(contentProjects).orderBy(desc(contentProjects.id)).all();
  }
  getContentProjectById(id: number): ContentProject | undefined {
    return db.select().from(contentProjects).where(eq(contentProjects.id, id)).get();
  }
  createContentProject(data: InsertContentProject): ContentProject {
    return db.insert(contentProjects).values(data).returning().get();
  }
  updateContentProject(id: number, patch: Partial<InsertContentProject>): ContentProject | undefined {
    return db.update(contentProjects).set(patch).where(eq(contentProjects.id, id)).returning().get();
  }

  // ── ATOM Content: Generations
  getContentGenerations(projectId?: number): ContentGeneration[] {
    if (projectId) {
      return db.select().from(contentGenerations).where(eq(contentGenerations.projectId, projectId)).orderBy(desc(contentGenerations.id)).all();
    }
    return db.select().from(contentGenerations).orderBy(desc(contentGenerations.id)).all();
  }
  getContentGenerationById(id: number): ContentGeneration | undefined {
    return db.select().from(contentGenerations).where(eq(contentGenerations.id, id)).get();
  }
  createContentGeneration(data: InsertContentGeneration): ContentGeneration {
    return db.insert(contentGenerations).values(data).returning().get();
  }
  updateContentGeneration(id: number, patch: Partial<InsertContentGeneration>): ContentGeneration | undefined {
    return db.update(contentGenerations).set(patch).where(eq(contentGenerations.id, id)).returning().get();
  }

  // ── ATOM Content: Voice profiles
  getVoiceProfiles(): VoiceProfile[] {
    return db.select().from(voiceProfiles).orderBy(desc(voiceProfiles.id)).all();
  }
  getActiveVoiceProfile(): VoiceProfile | undefined {
    return db.select().from(voiceProfiles).where(eq(voiceProfiles.active, true)).get();
  }
  createVoiceProfile(data: InsertVoiceProfile): VoiceProfile {
    return db.insert(voiceProfiles).values(data).returning().get();
  }
  updateVoiceProfile(id: number, patch: Partial<InsertVoiceProfile>): VoiceProfile | undefined {
    return db.update(voiceProfiles).set(patch).where(eq(voiceProfiles.id, id)).returning().get();
  }
  setActiveVoiceProfile(id: number): void {
    const tx = sqlite.transaction(() => {
      db.update(voiceProfiles).set({ active: false }).run();
      db.update(voiceProfiles).set({ active: true }).where(eq(voiceProfiles.id, id)).run();
    });
    tx();
  }

  // ── ATOM Content: Product activity metrics
  getProductActivityMetrics(opts?: { sourceSystem?: string; from?: string; to?: string; includeDemo?: boolean }): ProductActivityMetric[] {
    const clauses: any[] = [];
    if (opts?.sourceSystem) clauses.push(sql`${productActivityMetrics.sourceSystem} = ${opts.sourceSystem}`);
    if (opts?.from) clauses.push(sql`${productActivityMetrics.capturedAt} >= ${opts.from}`);
    if (opts?.to) clauses.push(sql`${productActivityMetrics.capturedAt} <= ${opts.to}`);
    if (!opts?.includeDemo) clauses.push(sql`${productActivityMetrics.isDemo} = 0`);
    let q: any = db.select().from(productActivityMetrics);
    if (clauses.length) {
      q = q.where(clauses.reduce((acc, c) => sql`${acc} AND ${c}`));
    }
    return q.orderBy(desc(productActivityMetrics.capturedAt)).all();
  }
  createProductActivityMetric(data: InsertProductActivityMetric): ProductActivityMetric {
    return db.insert(productActivityMetrics).values(data).returning().get();
  }
  upsertProductionMetric(data: InsertProductActivityMetric): ProductActivityMetric {
    // Match only production rows on the natural key; demo rows are immutable here.
    const tx = sqlite.transaction(() => {
      db.delete(productActivityMetrics).where(
        sql`${productActivityMetrics.metricKey} = ${data.metricKey}
          AND ${productActivityMetrics.sourceSystem} = ${data.sourceSystem}
          AND ${productActivityMetrics.sourceRecordId} IS ${data.sourceRecordId ?? null}
          AND ${productActivityMetrics.isDemo} = 0`,
      ).run();
      return db.insert(productActivityMetrics).values({ ...data, isDemo: false }).returning().get();
    });
    return tx();
  }

  // ── ATOM Content: Product activity events
  getProductActivityEvents(opts?: {
    eventType?: string; sourceSystem?: string; from?: string; to?: string; includeDemo?: boolean; limit?: number;
  }): ProductActivityEvent[] {
    const clauses: any[] = [];
    if (opts?.eventType) clauses.push(sql`${productActivityEvents.eventType} = ${opts.eventType}`);
    if (opts?.sourceSystem) clauses.push(sql`${productActivityEvents.sourceSystem} = ${opts.sourceSystem}`);
    if (opts?.from) clauses.push(sql`${productActivityEvents.occurredAt} >= ${opts.from}`);
    if (opts?.to) clauses.push(sql`${productActivityEvents.occurredAt} <= ${opts.to}`);
    if (!opts?.includeDemo) clauses.push(sql`${productActivityEvents.isDemo} = 0`);
    let q: any = db.select().from(productActivityEvents);
    if (clauses.length) {
      q = q.where(clauses.reduce((acc, c) => sql`${acc} AND ${c}`));
    }
    q = q.orderBy(desc(productActivityEvents.occurredAt));
    if (opts?.limit) q = q.limit(opts.limit);
    return q.all();
  }

  insertProductActivityEvents(rows: InsertProductActivityEvent[]): { inserted: number; skipped: number } {
    if (rows.length === 0) return { inserted: 0, skipped: 0 };
    // INSERT OR IGNORE against the unique (source_system, source_record_id) index
    // makes re-ingestion idempotent without overwriting prior rows. changes()
    // reports how many rows the statement actually inserted.
    const stmt = sqlite.prepare(`
      INSERT OR IGNORE INTO product_activity_events
      (event_type, source_system, source_record_id, occurred_at, tenant_id, user_id,
       prospect_id, account_id, campaign_id, is_demo, metadata_json, created_at)
      VALUES (@eventType, @sourceSystem, @sourceRecordId, @occurredAt, @tenantId, @userId,
              @prospectId, @accountId, @campaignId, @isDemo, @metadataJson, @createdAt)
    `);
    let inserted = 0;
    const tx = sqlite.transaction((items: InsertProductActivityEvent[]) => {
      for (const r of items) {
        const info = stmt.run({
          eventType: r.eventType,
          sourceSystem: r.sourceSystem,
          sourceRecordId: r.sourceRecordId ?? null,
          occurredAt: r.occurredAt,
          tenantId: r.tenantId ?? null,
          userId: r.userId ?? null,
          prospectId: r.prospectId ?? null,
          accountId: r.accountId ?? null,
          campaignId: r.campaignId ?? null,
          isDemo: r.isDemo ? 1 : 0,
          metadataJson: r.metadataJson ?? null,
          createdAt: r.createdAt,
        });
        inserted += info.changes;
      }
    });
    tx(rows);
    return { inserted, skipped: rows.length - inserted };
  }

  countProductActivityEventsByType(opts?: {
    sourceSystem?: string; from?: string; to?: string; includeDemo?: boolean;
  }): Record<string, number> {
    const clauses: any[] = [];
    if (opts?.sourceSystem) clauses.push(sql`${productActivityEvents.sourceSystem} = ${opts.sourceSystem}`);
    if (opts?.from) clauses.push(sql`${productActivityEvents.occurredAt} >= ${opts.from}`);
    if (opts?.to) clauses.push(sql`${productActivityEvents.occurredAt} <= ${opts.to}`);
    if (!opts?.includeDemo) clauses.push(sql`${productActivityEvents.isDemo} = 0`);
    let q: any = db.select({ eventType: productActivityEvents.eventType, c: sql<number>`count(*)` }).from(productActivityEvents);
    if (clauses.length) {
      q = q.where(clauses.reduce((acc, c) => sql`${acc} AND ${c}`));
    }
    const rows = q.groupBy(productActivityEvents.eventType).all() as Array<{ eventType: string; c: number }>;
    const out: Record<string, number> = {};
    for (const r of rows) out[r.eventType] = r.c;
    return out;
  }

  // ── ATOM Content: Claims
  getContentClaims(generationId: number): ContentClaim[] {
    return db.select().from(contentClaims).where(eq(contentClaims.generationId, generationId)).orderBy(desc(contentClaims.id)).all();
  }
  replaceContentClaims(generationId: number, rows: InsertContentClaim[]): void {
    const tx = sqlite.transaction(() => {
      db.delete(contentClaims).where(eq(contentClaims.generationId, generationId)).run();
      for (const r of rows) db.insert(contentClaims).values(r).run();
    });
    tx();
  }

  // ── ATOM Content: Approval log
  getApprovalLog(generationId?: number): ApprovalLogEntry[] {
    if (generationId) {
      return db.select().from(approvalLog).where(eq(approvalLog.generationId, generationId)).orderBy(desc(approvalLog.id)).all();
    }
    return db.select().from(approvalLog).orderBy(desc(approvalLog.id)).all();
  }
  createApprovalLogEntry(data: InsertApprovalLogEntry): ApprovalLogEntry {
    return db.insert(approvalLog).values(data).returning().get();
  }
}

export const storage = new DatabaseStorage();

// Seed products on startup
function seedProducts() {
  const existing = storage.getProducts();
  if (existing.length > 0) return;

  const productData: InsertProduct[] = [
    {
      name: "Antimatter AI Platform",
      slug: "antimatter-ai",
      tagline: "Digital Solutions That Matter",
      description: "Full-service AI development, product design, and GTM strategy platform. We build production-ready AI systems, scalable web/mobile products, and data-driven go-to-market strategies for enterprises.",
      url: "https://antimatterai.com",
      category: "platform",
      targetMarket: "Enterprise organizations, SaaS companies, startups needing AI-powered product development and go-to-market execution",
      keyFeatures: JSON.stringify([
        "End-to-end product design (UX/UI)",
        "Frontend/Backend development (React, Next, Node, Flutter)",
        "AI Development (LLM agents, RAG, fine-tuning, model evals)",
        "GTM Strategy (ICP, positioning, pricing, demand gen)",
        "Healthcare App Development (HIPAA compliant)",
        "IoT Development (firmware, edge AI, MQTT)"
      ]),
      valueProps: JSON.stringify([
        "20+ projects delivered with 100% client satisfaction",
        "Full-stack capability from design to deployment to market",
        "AI-native approach to every solution",
        "24/7 support with dedicated teams",
        "Proven case studies: Clinix AI, OWASP Foundation, Synergies4"
      ]),
      commonObjections: JSON.stringify([
        "We already have an in-house dev team",
        "AI development is too expensive",
        "We're not ready for AI yet",
        "How do we know your AI will work?",
        "We've been burned by agencies before"
      ]),
      competitiveEdge: "Unlike traditional agencies, Antimatter AI is AI-native — every solution leverages machine learning from day one. We combine product design, engineering, AI development, and GTM under one roof, eliminating handoff friction and accelerating time-to-market by 3-5x.",
      icon: "Atom"
    },
    {
      name: "Vidzee",
      slug: "vidzee",
      tagline: "Listing Photos to Cinematic Videos",
      description: "AI-powered platform that transforms real estate listing photos into cinematic property videos in under 5 minutes. Upload photos, AI storyboards and generates professional videos for Reels, TikTok, YouTube, and MLS.",
      url: "https://vidzee.vercel.app",
      category: "real-estate",
      targetMarket: "Real estate agents, brokerages, property managers, luxury agents, new agents, team leads at Compass, RE/MAX, Sotheby's, Keller Williams, Coldwell Banker, eXp Realty",
      keyFeatures: JSON.stringify([
        "AI-powered storyboarding (room detection, scene ordering, best-shot selection)",
        "Cinematic video generation powered by Kling AI",
        "Professional camera motions (Push In, Pan Left/Right, Tilt Up/Down)",
        "Multi-format export (9:16 for Reels/TikTok, 16:9 for YouTube/MLS)",
        "3 style packs: Modern Clean, Luxury Classic, Bold Dynamic",
        "Custom branding, team accounts, API access, white-label exports"
      ]),
      valueProps: JSON.stringify([
        "Create cinematic listing videos in under 5 minutes (not days)",
        "Save $200-$500 per video vs. hiring a videographer",
        "12,400+ videos created by 2,800+ agents",
        "One upload yields two formats for all platforms",
        "Consistent branding across entire team"
      ]),
      commonObjections: JSON.stringify([
        "I already hire a videographer",
        "AI videos won't look professional enough",
        "My listings don't need video",
        "I don't have time to learn new tools",
        "Free plan seems too limited"
      ]),
      competitiveEdge: "Vidzee replaces the $200-$500/video cost of a videographer with AI that produces cinematic results in 5 minutes. Smart storyboarding detects rooms, orders scenes logically, and applies professional camera motions — no editing skills required. Top producers at Compass, RE/MAX, and Sotheby's already use it.",
      icon: "Video"
    },
    {
      name: "Clinix Agent",
      slug: "clinix-agent",
      tagline: "Supervised AI Billing Operations",
      description: "All-in-one platform helping healthcare providers, hospitals, and billing teams recover lost revenue by automating insurance denial appeals and resubmissions. From intake to payment — automates claims, denials, and appeals in one workflow.",
      url: "https://www.clinixagent.com",
      category: "healthcare",
      targetMarket: "Healthcare providers, hospitals, billing teams, RCM teams, medical billing companies",
      keyFeatures: JSON.stringify([
        "Eligibility Guardrails (plan rules, copay, prior-auth warnings from 270/271)",
        "Clean Claim Engine (payer-aware modifiers, POS validation, ICD↔CPT pointers)",
        "Live Status + Remits (276/277 real-time acceptance, 835 pattern parsing)",
        "Appeal Intelligence (template 275 attachments, track overturn rates)",
        "HIPAA-grade security (E2E encryption, RLS, audit trails)",
        "Success-based pricing (0.6-1.2% paid claims, 5-12% recovery)"
      ]),
      valueProps: JSON.stringify([
        "Stop denials before they start with eligibility guardrails",
        "Auto-generate corrections and appeal packets tailored to payer policy",
        "Track claim status and recovery with real-time reporting",
        "ML-powered signals from eligibility, status, and remits",
        "Pay only on success — aligned incentives"
      ]),
      commonObjections: JSON.stringify([
        "We already have a billing team",
        "We're worried about HIPAA compliance",
        "Our denial rate is manageable",
        "We don't trust AI with patient data",
        "Integration with our EHR seems complex"
      ]),
      competitiveEdge: "Clinix Agent combines Stedi rails with payer-specific rules and ML signals — not just a billing tool but an intelligent denial prevention engine. With success-based pricing, you only pay when we recover revenue. Dedicated VM per tenant with immutable audit trails for maximum security.",
      icon: "ShieldCheck"
    },
    {
      name: "Clinix AI",
      slug: "clinix-ai",
      tagline: "AI-Powered Healthcare Documentation Automation",
      description: "Revolutionizing healthcare with AI-driven automation for medical documentation, SOAP notes, billing, and claims management. Extracts diagnoses, procedures, and justifications from clinical notes and generates ICD-10, CPT, and DSM-5-TR codes.",
      url: "https://www.tryclinixai.com",
      category: "healthcare",
      targetMarket: "Healthcare providers, clinicians, medical practices, behavioral health providers, hospitals",
      keyFeatures: JSON.stringify([
        "AI-powered SOAP note automation",
        "ICD-10, CPT, and DSM-5-TR code generation from clinical notes",
        "Seamless EHR integration",
        "Real-time updates and clinical workflow management",
        "Patient visit and billing summary management",
        "Diagnosis extraction and procedure justification"
      ]),
      valueProps: JSON.stringify([
        "Cut documentation time by 70% — focus on patient care",
        "Accurate AI-generated coding reduces claim denials",
        "Seamless integration with existing EHR systems",
        "Real-time clinical workflow management",
        "Reduce administrative burden and burnout"
      ]),
      commonObjections: JSON.stringify([
        "AI can't capture clinical nuance",
        "We're comfortable with our current workflow",
        "What about coding accuracy?",
        "EHR integration is always a nightmare",
        "Our providers won't adopt new technology"
      ]),
      competitiveEdge: "Clinix AI doesn't just transcribe — it understands clinical context. AI extracts diagnoses, procedures, and justifications from notes and generates accurate ICD-10/CPT/DSM-5-TR codes in real-time, directly integrated with your EHR. Providers save 2-3 hours per day on documentation.",
      icon: "Stethoscope"
    },
    {
      name: "Red Team ATOM",
      slug: "red-team-atom",
      tagline: "Autonomous Quantum-Ready Red Team Range",
      description: "Active adversarial simulation platform with post-quantum cryptography engine, AI & quantum attack telemetry, and MITRE ATLAS & Quantum technique heatmaps. Autonomous red teaming for the quantum computing era.",
      url: "https://red-team-atom.vercel.app",
      category: "cybersecurity",
      targetMarket: "CISOs, security teams, defense contractors, government agencies, Fortune 500 security operations, compliance officers",
      keyFeatures: JSON.stringify([
        "PQC Engine (lattice-based key rotation, harvest-now-decrypt-later safe)",
        "AI & Quantum Attack Telemetry (real-time)",
        "Threat Analytics (Critical, High, Model Attacks, Prompt Inject)",
        "Red Team Defense Logging",
        "MITRE ATLAS & Quantum Technique Heatmap",
        "Agent-level, model attack, and quantum threat filters"
      ]),
      valueProps: JSON.stringify([
        "Only autonomous red team platform that's quantum-ready",
        "Proactively defend against harvest-now-decrypt-later attacks",
        "Real-time AI and quantum attack telemetry across your stack",
        "MITRE ATLAS compliance mapping out of the box",
        "Continuous adversarial simulation — not annual pen tests"
      ]),
      commonObjections: JSON.stringify([
        "Quantum threats are years away",
        "We already do annual penetration testing",
        "Our team doesn't have quantum security expertise",
        "This seems too advanced for our current needs",
        "How does this integrate with our existing SOC?"
      ]),
      competitiveEdge: "Red Team ATOM is the industry's first autonomous, quantum-ready red team range. While competitors offer static pen testing, ATOM runs continuous adversarial simulations with PQC-grade key rotation, real-time AI attack telemetry, and MITRE ATLAS heatmapping. If you're not preparing for quantum threats now, you're already behind.",
      icon: "Shield"
    }
  ];

  for (const p of productData) {
    storage.createProduct(p);
  }
  console.log("Seeded", productData.length, "products");
}

seedProducts();

function seedScoringTemplates() {
  const existing = storage.getScoringTemplates();
  if (existing.length > 0) return;
  const now = new Date().toISOString();
  storage.createScoringTemplate({
    slug: "healthcare-segmentation-hipaa",
    name: "Healthcare × Segmentation (HIPAA-aligned)",
    description: "Akamai Guardicore play. Scores PHI exposure, breach history, account fit, list density, segmentation relevance + ATOM live signals.",
    weightsJson: JSON.stringify({ regulatory: 25, breach: 20, accountFit: 15, listDensity: 5, segmentation: 5, atomIntent: 12, atomPersonas: 10, atomFreshness: 8 }),
    subVerticalProfileJson: JSON.stringify({
      "Healthcare Provider": { phi: 1.0, seg: 1.0 },
      "Healthcare Payer": { phi: 0.95, seg: 0.9 },
      "Pharma and Biotech": { phi: 0.55, seg: 0.85 },
      "Medical Devices and Equipment": { phi: 0.45, seg: 0.95 },
      "Health Tech": { phi: 0.7, seg: 0.8 },
    }),
    revenueTiersJson: JSON.stringify([
      { min: 50_000_000_000, factor: 1.0 },
      { min: 10_000_000_000, factor: 0.92 },
      { min: 2_000_000_000, factor: 0.78 },
      { min: 500_000_000, factor: 0.62 },
      { min: 100_000_000, factor: 0.45 },
      { min: 0, factor: 0.25 },
    ]),
    akafitMultipliersJson: JSON.stringify({ A: 1.0, B: 0.65, C: 0.3 }),
    walletMultipliersJson: JSON.stringify({ "Mega Strategic": 1.0, Strategic: 0.85, "Large Enterprise": 0.65 }),
    segmentationFitJson: JSON.stringify({ Provider: 1.0, Devices: 0.95, Payer: 0.9, Pharma: 0.85, HealthTech: 0.8 }),
    tierThresholdsJson: JSON.stringify({ t1: 75, t2: 60, t3: 45 }),
    whyNowTemplate: "2025 HIPAA Security Rule mandates network segmentation (effective 2026) — Guardicore is the direct fulfillment vehicle.",
    recommendedMoveJson: JSON.stringify({
      T1: "CISO meeting THIS week. Lead with breach map + 30-day Guardicore POC.",
      T2: "Executive briefing within 14 days. Frame as HIPAA-2026 compliance accelerator.",
      T3: "Multi-touch sequence: warm intro → industry brief → demo.",
      T4: "Nurture. Quarterly check-in unless a peer breach triggers urgency.",
    }),
    isSystem: true,
    createdAt: now,
  });
  console.log("Seeded scoring templates: healthcare-segmentation-hipaa");
}

seedScoringTemplates();

// ── ATOM Content seeds: default voice profile + demo activity metrics
function seedVoiceProfile() {
  if (storage.getVoiceProfiles().length > 0) return;
  const now = new Date().toISOString();
  storage.createVoiceProfile({
    name: "ATOM Sales OS — Command Voice",
    yamlContent: DEFAULT_VOICE_YAML,
    active: true,
    createdAt: now,
    updatedAt: now,
  });
  console.log("Seeded ATOM Content default voice profile");
}
seedVoiceProfile();

function seedDemoMetrics() {
  // Only seed demo metrics; production metrics arrive from real worker activity.
  const existingDemo = storage.getProductActivityMetrics({ includeDemo: true }).filter((m) => m.isDemo);
  if (existingDemo.length > 0) return;
  const now = Date.now();
  const iso = (daysAgo: number) => new Date(now - daysAgo * 86_400_000).toISOString();
  const demo: InsertProductActivityMetric[] = [
    { metricKey: "leads_generated", metricLabel: "Leads generated", metricValue: 42, unit: "", sourceSystem: "atom-leadgen", sourceRecordId: "demo-lg-1", confidence: "high", isDemo: true, capturedAt: iso(3), metadataJson: JSON.stringify({ window: "last_30d" }) },
    { metricKey: "reply_rate_delta", metricLabel: "Reply-rate increase", metricValue: 31, unit: "%", sourceSystem: "campaigns", sourceRecordId: "demo-cmp-7", confidence: "verified", isDemo: true, capturedAt: iso(5), metadataJson: JSON.stringify({ baseline: "9%", current: "11.8%" }) },
    { metricKey: "events_processed", metricLabel: "Signal events processed", metricValue: 5204, unit: "events", sourceSystem: "atom-warroom", sourceRecordId: "demo-wr-3", confidence: "high", isDemo: true, capturedAt: iso(1), metadataJson: null },
    { metricKey: "followup_time_reduction", metricLabel: "Follow-up time reduced", metricValue: 74, unit: "%", sourceSystem: "atom-leadgen", sourceRecordId: "demo-lg-9", confidence: "medium", isDemo: true, capturedAt: iso(8), metadataJson: JSON.stringify({ note: "sample of 120 sequences" }) },
    { metricKey: "dials_today", metricLabel: "Outbound dials (today)", metricValue: 318, unit: "", sourceSystem: "atom-leadgen", sourceRecordId: "demo-lg-12", confidence: "verified", isDemo: true, capturedAt: iso(0), metadataJson: null },
    { metricKey: "pipeline_influenced", metricLabel: "Pipeline influenced", metricValue: 1.2, unit: "$M", sourceSystem: "campaigns", sourceRecordId: "demo-cmp-22", confidence: "low", isDemo: true, capturedAt: iso(12), metadataJson: JSON.stringify({ caveat: "attribution model v0" }) },
  ];
  for (const m of demo) storage.createProductActivityMetric(m);
  console.log("Seeded", demo.length, "demo product activity metrics");
}
seedDemoMetrics();
