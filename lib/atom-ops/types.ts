/**
 * ATOM Ops — shared types.
 * Every tool returns OpsResult<T>. No untyped `any` crosses tool boundaries.
 */

export interface OpsResult<T = unknown> {
  ok: boolean;
  data: T;
  summary: string;
}

/** Metadata exposed by every tool action so the orchestrator can gate destructive ops. */
export interface ToolActionMeta {
  tool: string;
  action: string;
  destructive: boolean;
  description: string;
}

/**
 * A single executable tool action plus its metadata. Registry entries accept an
 * untyped params bag (validated/narrowed inside the concrete function) and
 * return a typed OpsResult. Concrete exported functions keep their precise
 * param types; the registry is the dynamic dispatch surface.
 */
export interface ToolAction {
  meta: ToolActionMeta;
  run: (params: Record<string, unknown>) => Promise<OpsResult>;
}

/** Where the intent originated — used for audit + auth scoping. */
export type OpsSource = "console" | "telegram" | "cron" | "api";

/** Authenticated actor context threaded through dispatch + audit. */
export interface OpsContext {
  actorEmail: string;
  actorRole?: string | null;
  isSuperAdmin: boolean;
  source: OpsSource;
  /** Stable per-session id (cookie token hash, telegram chat id, etc). */
  sessionId: string;
  /** When true, a previously-issued confirmation is being redeemed. */
  confirmationId?: string;
  confirmed?: boolean;
}

/** A pending, not-yet-executed destructive operation. */
export interface ConfirmationPlan {
  confirmationId: string;
  intent: string;
  tool: string;
  action: string;
  destructive: true;
  summary: string;
  params: Record<string, unknown>;
  createdAt: number;
  expiresAt: number;
  actorEmail: string;
}

/** Discriminated result of OpsOrchestrator.dispatch(). */
export type DispatchResult =
  | { kind: "result"; result: OpsResult }
  | { kind: "confirm"; plan: ConfirmationPlan }
  | { kind: "cancelled"; confirmationId: string; summary: string }
  | { kind: "error"; summary: string };

/**
 * Helper to build a typed failure result without throwing. Generic so it can be
 * returned from any `OpsResult<T>`-typed function (data is null at runtime; the
 * ok:false discriminant means callers must not read it).
 */
export function fail<T = null>(summary: string): OpsResult<T> {
  return { ok: false, data: null as T, summary };
}

/** Helper to build a typed success result. */
export function ok<T>(data: T, summary: string): OpsResult<T> {
  return { ok: true, data, summary };
}

/** Narrowing guard for unknown error values inside catch blocks. */
export function errMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === "string") return e;
  try {
    return JSON.stringify(e);
  } catch {
    return "unknown error";
  }
}
