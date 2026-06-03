/**
 * Server-side session resolution for ATOM Support.
 * Reads the atom_session cookie → user_sessions → tenant_users → tenants.
 * Mirrors api/auth/me.ts but returns a lean shape for support context.
 */
import { sb, parseCookies, supabaseConfigured } from "./supabase";

export interface ResolvedSession {
  authenticated: boolean;
  userId?: string;
  email?: string;
  fullName?: string;
  role?: string;
  tenantId?: string;
  tenantSlug?: string;
  tenantName?: string;
  plan?: string;
  subscriptionStatus?: string;
}

export async function resolveSession(cookieHeader: string | undefined): Promise<ResolvedSession> {
  if (!supabaseConfigured()) return { authenticated: false };
  const token = parseCookies(cookieHeader)["atom_session"];
  if (!token) return { authenticated: false };

  try {
    const sessions = await sb(
      `user_sessions?token=eq.${encodeURIComponent(token)}&revoked_at=is.null&select=user_id,tenant_id,expires_at`,
    );
    const session = Array.isArray(sessions) ? sessions[0] : null;
    if (!session) return { authenticated: false };
    if (new Date(session.expires_at) < new Date()) return { authenticated: false };

    const users = await sb(
      `tenant_users?id=eq.${session.user_id}&deleted_at=is.null&select=id,email,full_name,role,tenant_id`,
    );
    const user = Array.isArray(users) ? users[0] : null;
    if (!user) return { authenticated: false };

    const tenants = await sb(
      `tenants?id=eq.${session.tenant_id}&deleted_at=is.null&select=id,slug,name,plan,subscription_status`,
    );
    const tenant = Array.isArray(tenants) ? tenants[0] : null;
    if (!tenant) return { authenticated: false };

    return {
      authenticated: true,
      userId: user.id,
      email: user.email,
      fullName: user.full_name,
      role: user.role,
      tenantId: tenant.id,
      tenantSlug: tenant.slug,
      tenantName: tenant.name,
      plan: tenant.plan,
      subscriptionStatus: tenant.subscription_status,
    };
  } catch (e: any) {
    console.warn("[support auth] resolveSession failed:", e?.message);
    return { authenticated: false };
  }
}
