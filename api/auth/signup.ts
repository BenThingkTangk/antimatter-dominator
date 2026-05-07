/**
 * POST /api/auth/signup
 * Body: { email, password, fullName, companyName?, plan? }
 *
 * Creates tenant + admin user + session. Sets atom_session cookie.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { sendEmail, brandedEmail } from "../_email";

const clean = (v: string | undefined) => (v || "").replace(/\\n/g, "").trim();
const SUPABASE_URL = clean(process.env.SUPABASE_URL);
const SUPABASE_SERVICE_ROLE_KEY = clean(process.env.SUPABASE_SERVICE_ROLE_KEY);

async function sb(path: string, init: RequestInit = {}) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(init.headers || {}),
    },
  });
  const t = await r.text();
  if (!r.ok) throw new Error(`Supabase ${r.status}: ${t.slice(0, 260)}`);
  return t ? JSON.parse(t) : null;
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", req.headers.origin || "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Credentials", "true");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const body = req.body || {};
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    const fullName = String(body.fullName || "").trim();
    const companyName = String(body.companyName || "").trim();
    const plan = String(body.plan || "trial").trim();

    // Validate
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: "Valid email required" });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: "Password must be at least 8 characters" });
    }
    if (!fullName) {
      return res.status(400).json({ error: "Full name required" });
    }

    // Check if email already exists across any tenant
    const existing = await sb(
      `tenant_users?email=eq.${encodeURIComponent(email)}&deleted_at=is.null&select=id&limit=1`
    );
    if (Array.isArray(existing) && existing.length > 0) {
      return res.status(409).json({ error: "An account with this email already exists" });
    }

    // Generate unique slug
    const base = companyName ? slugify(companyName) : slugify(email.split("@")[0]);
    const suffix = crypto.randomBytes(2).toString("hex");
    let slug = `${base}-${suffix}`;
    // Ensure unique
    const slugCheck = await sb(`tenants?slug=eq.${encodeURIComponent(slug)}&select=id&limit=1`);
    if (Array.isArray(slugCheck) && slugCheck.length > 0) {
      slug = `${base}-${crypto.randomBytes(3).toString("hex")}`;
    }

    // Create tenant
    const trialEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
    const tenantRows = await sb("tenants", {
      method: "POST",
      body: JSON.stringify({
        slug,
        name: companyName || fullName,
        plan: "trial",
        trial_ends_at: trialEndsAt,
        subscription_status: "trialing",
        owner_email: email,
        primary_hex: "#00e6d3",
        accent_hex: "#00a7ff",
      }),
    });
    const tenant = Array.isArray(tenantRows) ? tenantRows[0] : tenantRows;
    if (!tenant?.id) throw new Error("Failed to create tenant");

    // Hash password and create user
    const passwordHash = await bcrypt.hash(password, 10);
    const userRows = await sb("tenant_users", {
      method: "POST",
      body: JSON.stringify({
        tenant_id: tenant.id,
        email,
        full_name: fullName,
        role: "admin",
        password_hash: passwordHash,
        accepted_at: new Date().toISOString(),
      }),
    });
    const user = Array.isArray(userRows) ? userRows[0] : userRows;
    if (!user?.id) throw new Error("Failed to create user");

    // Generate session token
    const token = crypto.randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    await sb("user_sessions", {
      method: "POST",
      body: JSON.stringify({
        user_id: user.id,
        tenant_id: tenant.id,
        token,
        user_agent: (req.headers["user-agent"] || "").slice(0, 512),
        ip: (req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "").toString().split(",")[0].trim(),
        expires_at: expiresAt,
      }),
    });

    // Set cookie
    res.setHeader(
      "Set-Cookie",
      `atom_session=${token}; HttpOnly; Secure; Path=/; Max-Age=604800; SameSite=Lax`
    );

    // Welcome email — fire-and-forget; never blocks signup.
    const origin = req.headers.origin || "https://atom-dominator-pro.vercel.app";
    sendEmail({
      to: email,
      subject: `Welcome to ΔTOM — your AI sales operating system is live`,
      html: brandedEmail({
        preheader: `Your ${tenant.name} workspace is provisioned. Pick a plan and start your 14-day free trial.`,
        heading: `Welcome aboard, ${fullName.split(" ")[0]}`,
        body: `
          <p>Your <strong style="color:#e8e8ea">${tenant.name}</strong> workspace is live on ΔTOM (ATOM Sales Dominator) — the AI sales operating system from AntimatterAI.</p>
          <p>You're signed in as <strong style="color:#e8e8ea">admin</strong>. Next step: pick a plan, choose your seat count, and start your 14-day free trial. No charge until day 15 — cancel anytime.</p>
          <ul style="padding-left:18px;margin:14px 0;color:#e8e8ea;">
            <li>ΔTOM Pitch — brutal, lethal call openers in seconds</li>
            <li>ΔTOM Dial — voice agents that book meetings while you sleep</li>
            <li>ΔTOM Campaign — multi-channel orchestration with premium signals</li>
            <li>ΔTOM Market Intent + War Room — industry intel that pays for itself</li>
          </ul>
        `,
        ctaLabel: "Pick your plan & start trial",
        ctaUrl: `${origin}/#/billing`,
        footer: `Your trial doesn't start until you select a paid plan and confirm in Stripe — we never charge a card on signup. Reply to this email any time with questions.`,
      }),
      text: `Welcome to ΔTOM. Pick a plan + start your 14-day free trial: ${origin}/#/billing`,
    }).catch(() => {});

    return res.status(201).json({
      tenant: {
        id: tenant.id,
        slug: tenant.slug,
        name: tenant.name,
        plan: tenant.plan,
        trial_ends_at: tenant.trial_ends_at,
      },
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        fullName: user.full_name,
      },
      role: user.role,
      isSuperAdmin: false,
      redirectTo: plan !== "trial" ? `/api/billing/checkout?plan=${plan}` : "/",
    });
  } catch (e: any) {
    console.error("[auth/signup]", e?.message);
    return res.status(500).json({ error: e?.message || "internal" });
  }
}
