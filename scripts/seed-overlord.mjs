#!/usr/bin/env node
/**
 * Seed the Nirmata super_admin overlord user.
 * Idempotent: upserts on conflict.
 */
import fs from "node:fs";
import bcrypt from "bcryptjs";

let SUPABASE_URL = "";
let SERVICE_KEY = "";
const txt = fs.readFileSync("/home/user/workspace/supabase_keys.txt", "utf-8");
for (const line of txt.split("\n")) {
  const sep = Math.min(...[line.indexOf(":"), line.indexOf("=")].filter((i) => i >= 0));
  if (!Number.isFinite(sep) || sep < 0) continue;
  const k = line.slice(0, sep).trim();
  const v = line.slice(sep + 1).trim();
  if (k === "SUPABASE_URL") SUPABASE_URL = v;
  if (k === "SUPABASE_SERVICE_ROLE_KEY") SERVICE_KEY = v;
}

const EMAIL    = "ben.oleary@thingktangk.com";
const PASSWORD = "Lambo2391!";
const FULL     = "Ben O'Leary";

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
console.log(`Password  : ${PASSWORD}`);
console.log(`Tenant    : ${tenant.name} (${tenant.slug})`);
console.log(`Role      : admin (super_admin via NIRMATA_HQ_EMAILS allow-list)`);
console.log("──────────────────────────────────────────────");
