import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Products in the Antimatter ecosystem
export const products = sqliteTable("products", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  tagline: text("tagline").notNull(),
  description: text("description").notNull(),
  url: text("url").notNull(),
  category: text("category").notNull(), // 'ai-development', 'healthcare', 'cybersecurity', 'real-estate', 'platform'
  targetMarket: text("target_market").notNull(),
  keyFeatures: text("key_features").notNull(), // JSON array stored as text
  valueProps: text("value_props").notNull(), // JSON array stored as text
  commonObjections: text("common_objections").notNull(), // JSON array stored as text
  competitiveEdge: text("competitive_edge").notNull(),
  icon: text("icon").notNull(), // lucide icon name
});

// Generated pitches
export const pitches = sqliteTable("pitches", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  productId: integer("product_id").notNull(),
  pitchType: text("pitch_type").notNull(), // 'elevator', 'email', 'cold-call', 'demo-intro', 'executive-brief'
  targetPersona: text("target_persona").notNull(),
  content: text("content").notNull(),
  createdAt: text("created_at").notNull(),
});

// Objection handling records
export const objections = sqliteTable("objections", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  productId: integer("product_id").notNull(),
  objection: text("objection").notNull(),
  response: text("response").notNull(),
  category: text("category").notNull(), // 'price', 'competition', 'timing', 'authority', 'need', 'trust'
  createdAt: text("created_at").notNull(),
});

// Prospect pipeline (auto-discovered)
export const prospects = sqliteTable("prospects", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  companyName: text("company_name").notNull(),
  industry: text("industry").notNull(),
  score: real("score").notNull(), // 0-100 weighted score
  reason: text("reason").notNull(), // Why this company needs Antimatter
  matchedProducts: text("matched_products").notNull(), // JSON array of product slugs
  signals: text("signals").notNull(), // JSON array of market signals
  companySize: text("company_size").notNull(),
  urgency: text("urgency").notNull(), // 'critical', 'high', 'medium', 'low'
  lastUpdated: text("last_updated").notNull(),
  status: text("status").notNull().default("new"), // 'new', 'contacted', 'engaged', 'qualified', 'closed'
});

// ─── BULK CAMPAIGN IMPORT + SCORING (ΔTOM Sales Dominator v0.1)
// Lets an operator drop a CSV/XLSX of accounts, pick a scoring template,
// and produce a tiered, ATOM-enriched target list — all native to ΔTOM.

export const scoringTemplates = sqliteTable("scoring_templates", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  slug: text("slug").notNull().unique(), // 'healthcare-segmentation-hipaa'
  name: text("name").notNull(),
  description: text("description").notNull(),
  weightsJson: text("weights_json").notNull(), // JSON: dimension weights
  subVerticalProfileJson: text("sub_vertical_profile_json").notNull(), // JSON
  revenueTiersJson: text("revenue_tiers_json").notNull(), // JSON
  akafitMultipliersJson: text("akafit_multipliers_json").notNull(), // JSON
  walletMultipliersJson: text("wallet_multipliers_json").notNull(), // JSON
  segmentationFitJson: text("segmentation_fit_json").notNull(), // JSON
  tierThresholdsJson: text("tier_thresholds_json").notNull(), // JSON
  whyNowTemplate: text("why_now_template").notNull(),
  recommendedMoveJson: text("recommended_move_json").notNull(), // per-tier JSON
  isSystem: integer("is_system", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull(),
});

export const campaigns = sqliteTable("campaigns", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  productSlug: text("product_slug").notNull(), // existing product or custom slug
  productLabel: text("product_label").notNull(), // human label e.g. 'Akamai Guardicore Segmentation'
  scoringTemplateSlug: text("scoring_template_slug").notNull(),
  status: text("status").notNull().default("draft"), // draft|scoring|enriching|ready
  totalAccounts: integer("total_accounts").notNull().default(0),
  scoredAccounts: integer("scored_accounts").notNull().default(0),
  enrichedAccounts: integer("enriched_accounts").notNull().default(0),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const campaignAccounts = sqliteTable("campaign_accounts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  campaignId: integer("campaign_id").notNull(),
  accountName: text("account_name").notNull(),
  domain: text("domain"),
  state: text("state"),
  subVertical: text("sub_vertical"),
  revenue: real("revenue"), // USD
  akafit: text("akafit"), // A|B|C
  walletGrade: text("wallet_grade"), // Mega Strategic|Strategic|Large Enterprise|...
  extraTagsJson: text("extra_tags_json"), // raw row JSON for extra columns / TAL membership
  // Sub-scores (0-max per dimension)
  scoreRegulatory: real("score_regulatory").default(0),
  scoreBreach: real("score_breach").default(0),
  scoreAccountFit: real("score_account_fit").default(0),
  scoreSegmentation: real("score_segmentation").default(0),
  scoreListDensity: real("score_list_density").default(0),
  scoreAtomIntent: real("score_atom_intent").default(0),
  scoreAtomPersonas: real("score_atom_personas").default(0),
  scoreAtomFreshness: real("score_atom_freshness").default(0),
  publicSubtotal: real("public_subtotal").default(0), // 0-70
  finalScore: real("final_score").default(0), // 0-100
  tier: text("tier"), // T1|T2|T3|T4
  whyNow: text("why_now"),
  recommendedMove: text("recommended_move"),
  // ATOM enrichment artifacts
  atomEnrichedAt: text("atom_enriched_at"),
  atomPainPointsJson: text("atom_pain_points_json"),
  atomBuyingSignalsJson: text("atom_buying_signals_json"),
  atomRecentNewsJson: text("atom_recent_news_json"),
  atomTechStackJson: text("atom_tech_stack_json"),
  atomDecisionMakersJson: text("atom_decision_makers_json"),
  // Breach artifacts (after match)
  directBreachJson: text("direct_breach_json"),
  peerBreachJson: text("peer_breach_json"),
  // Operational
  enrichStatus: text("enrich_status").notNull().default("pending"), // pending|running|done|failed
  enrichError: text("enrich_error"),
  pushedTo: text("pushed_to"), // 'warroom'|'campaign'|'prospects'|null
  createdAt: text("created_at").notNull(),
});

// Market intel entries
export const marketIntel = sqliteTable("market_intel", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  summary: text("summary").notNull(),
  relevantProducts: text("relevant_products").notNull(), // JSON array
  impactLevel: text("impact_level").notNull(), // 'high', 'medium', 'low'
  source: text("source").notNull(),
  category: text("category").notNull(), // 'regulation', 'competitor', 'technology', 'market-shift', 'funding'
  createdAt: text("created_at").notNull(),
});

// Insert schemas
export const insertProductSchema = createInsertSchema(products).omit({ id: true });
export const insertPitchSchema = createInsertSchema(pitches).omit({ id: true });
export const insertObjectionSchema = createInsertSchema(objections).omit({ id: true });
export const insertProspectSchema = createInsertSchema(prospects).omit({ id: true });
export const insertMarketIntelSchema = createInsertSchema(marketIntel).omit({ id: true });
export const insertCampaignSchema = createInsertSchema(campaigns).omit({ id: true });
export const insertCampaignAccountSchema = createInsertSchema(campaignAccounts).omit({ id: true });
export const insertScoringTemplateSchema = createInsertSchema(scoringTemplates).omit({ id: true });

// Types
export type Product = typeof products.$inferSelect;
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type Pitch = typeof pitches.$inferSelect;
export type InsertPitch = z.infer<typeof insertPitchSchema>;
export type Objection = typeof objections.$inferSelect;
export type InsertObjection = z.infer<typeof insertObjectionSchema>;
export type Prospect = typeof prospects.$inferSelect;
export type InsertProspect = z.infer<typeof insertProspectSchema>;
export type MarketIntel = typeof marketIntel.$inferSelect;
export type InsertMarketIntel = z.infer<typeof insertMarketIntelSchema>;
export type Campaign = typeof campaigns.$inferSelect;
export type InsertCampaign = z.infer<typeof insertCampaignSchema>;
export type CampaignAccount = typeof campaignAccounts.$inferSelect;
export type InsertCampaignAccount = z.infer<typeof insertCampaignAccountSchema>;
export type ScoringTemplate = typeof scoringTemplates.$inferSelect;
export type InsertScoringTemplate = z.infer<typeof insertScoringTemplateSchema>;

// Request schemas for campaign endpoints
export const createCampaignSchema = z.object({
  name: z.string().min(1),
  productSlug: z.string().min(1),
  productLabel: z.string().min(1),
  scoringTemplateSlug: z.string().min(1),
});

export const importAccountsSchema = z.object({
  accounts: z.array(z.object({
    accountName: z.string().min(1),
    domain: z.string().optional().nullable(),
    state: z.string().optional().nullable(),
    subVertical: z.string().optional().nullable(),
    revenue: z.number().optional().nullable(),
    akafit: z.string().optional().nullable(),
    walletGrade: z.string().optional().nullable(),
    extraTags: z.record(z.any()).optional().nullable(),
  })).min(1).max(5000),
});

export const enrichRequestSchema = z.object({
  accountIds: z.array(z.number()).min(1).max(200),
});

export const pushRequestSchema = z.object({
  accountIds: z.array(z.number()).min(1),
  target: z.enum(["warroom", "campaign", "prospects"]),
});

export type CreateCampaignRequest = z.infer<typeof createCampaignSchema>;
export type ImportAccountsRequest = z.infer<typeof importAccountsSchema>;
export type EnrichRequest = z.infer<typeof enrichRequestSchema>;
export type PushRequest = z.infer<typeof pushRequestSchema>;

// Request/Response types for AI endpoints
export const pitchRequestSchema = z.object({
  productSlug: z.string(),
  pitchType: z.enum(["elevator", "email", "cold-call", "demo-intro", "executive-brief"]),
  targetPersona: z.string(),
  customContext: z.string().optional(),
});

export const objectionRequestSchema = z.object({
  productSlug: z.string(),
  objection: z.string(),
  context: z.string().optional(),
});

export const marketIntentRequestSchema = z.object({
  productSlug: z.string().optional(),
  industry: z.string().optional(),
  topic: z.string().optional(),
});

export const prospectScanRequestSchema = z.object({
  industry: z.string().optional(),
  productFocus: z.string().optional(),
});

export type PitchRequest = z.infer<typeof pitchRequestSchema>;
export type ObjectionRequest = z.infer<typeof objectionRequestSchema>;
export type MarketIntentRequest = z.infer<typeof marketIntentRequestSchema>;
export type ProspectScanRequest = z.infer<typeof prospectScanRequestSchema>;
