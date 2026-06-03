#!/usr/bin/env node
/**
 * Seed the Nirmata super_admin overlord user.
 * Idempotent: upserts on conflict.
 */
import crypto from "node:crypto";
import bcrypt from "bcryptjs";

// Credentials come from the environment — never hard-coded.
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY   (required)
//   OVERLORD_EMAIL                            (required)
//   OVERLORD_PASSWORD                         (optional — a strong random one is
//                                              generated and printed once if unset)
//   OVERLORD_FULL_NAME                        (optional)
const SUPABASE_URL = (process.env.SUPABASE_URL || "").trim();
const SERVICE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Missing SUPABASE_URL and/or SUPABASE_SERVICE_ROLE_KEY environment variables.");
  process.exit(1);
}

const EMAIL = (process.env.OVERLORD_EMAIL || "").trim();
if (!EMAIL) {
  console.error("Missing OVERLORD_EMAIL environment variable.");
  process.exit(1);
}

// If no password is supplied, generate a strong random one. It is printed exactly
// once at the end so the operator can capture it; it is never stored in source.
const GENERATED_PASSWORD = !process.env.OVERLORD_PASSWORD;
const PASSWORD = (process.env.OVERLORD_PASSWORD || "").trim() ||
  crypto.randomBytes(18).toString("base64url");
const FULL = (process.env.OVERLORD_FULL_NAME || EMAIL.split("@")[0]).trim();

async function sb(p, init = {}) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${p}`, {
    ...init,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      Prefer: init.method && init.method !== "GET" ? "return=representation" : "",
      ...(init.headers || {}),
    },
  });
  const t = await r.text();
  if (!r.ok) throw new Error(`${r.status} ${p} ${t.slice(0, 240)}`);
  return t ? JSON.parse(t) : null;
}

const tenants = await sb("tenants?slug=eq.antimatter&select=id,slug,name");
const tenant = tenants[0];
if (!tenant) throw new Error("antimatter tenant missing");
console.log("✓ Tenant:", tenant.name, tenant.id);

const hash = await bcrypt.hash(PASSWORD, 10);
console.log("✓ bcrypt hash generated");

const existing = await sb(`tenant_users?email=eq.${encodeURIComponent(EMAIL)}&select=id,role`);
if (existing.length) {
  await sb(`tenant_users?id=eq.${existing[0].id}`, {
    method: "PATCH",
    body: JSON.stringify({ password_hash: hash, role: "admin", full_name: FULL, deleted_at: null, accepted_at: new Date().toISOString() }),
  });
  console.log(`✓ Updated existing user ${EMAIL} (${existing[0].id})`);
} else {
  const created = await sb("tenant_users", {
    method: "POST",
    body: JSON.stringify([{
      tenant_id: tenant.id,
      email: EMAIL,
      full_name: FULL,
      role: "admin",
      password_hash: hash,
      accepted_at: new Date().toISOString(),
      invited_at: new Date().toISOString(),
    }]),
  });
  console.log(`✓ Created user ${EMAIL} (${created[0].id})`);
}

console.log("\n──────────────────────────────────────────────");
console.log("OVERLORD CREDENTIALS");
console.log("──────────────────────────────────────────────");
console.log(`Email     : ${EMAIL}`);
if (GENERATED_PASSWORD) {
  console.log(`Password  : ${PASSWORD}   ← generated, shown ONCE — store it now`);
} else {
  console.log(`Password  : (from OVERLORD_PASSWORD env — not printed)`);
}
console.log(`Tenant    : ${tenant.name} (${tenant.slug})`);
console.log(`Role      : admin (super_admin via NIRMATA_HQ_EMAILS allow-list)`);
console.log("──────────────────────────────────────────────");
