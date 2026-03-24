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
