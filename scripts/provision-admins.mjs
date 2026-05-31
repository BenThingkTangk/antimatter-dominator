#!/usr/bin/env node
/**
 * Provision admin users for ATOM Sales OS — no email / no invite flow.
 *
 * SECURITY:
 *   - Never hardcodes or prints plaintext passwords.
 *   - Reads passwords ONLY from environment variables or an interactive prompt.
 *   - Stores bcrypt hashes only (cost 12).
 *   - Creates already-accepted ("confirmed") users; does NOT send any email/invite.
 *
 * Required env (Supabase service role — same vars the API uses):
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   (fallback: a keys file at SUPABASE_KEYS_FILE or /home/user/workspace/supabase_keys.txt
 *    containing `SUPABASE_URL=...` / `SUPABASE_SERVICE_ROLE_KEY=...` lines)
 *
 * Password input (per email, choose ONE):
 *   1. Env var per user, slug derived from the local-part of the email, e.g.
 *        ADMIN_PW_BEN=...                (ben@antimatterai.com)
 *        ADMIN_PW_JOSH_MELLOTT=...       (josh.mellott@thingktangk.com)
 *        ADMIN_PW_JOEL_BEDARD=...        (joel.bedard@thingktangk.com)
 *      (the env var name is printed in the run plan if a password is missing)
 *   2. Interactive prompt (TTY) — the script asks for each missing password,
 *      input is hidden (not echoed).
 *
 * Flags:
 *   --tenant=<slug>   target tenant slug (default: antimatter)
 *   --dry-run         do everything except write to Supabase (no hashing of real
 *                     secrets is skipped; it validates connectivity + tenant + plan)
 *
 * Usage:
 *   node scripts/provision-admins.mjs --dry-run
 *   ADMIN_PW_BEN=... ADMIN_PW_JOSH_MELLOTT=... ADMIN_PW_JOEL_BEDARD=... \
 *     node scripts/provision-admins.mjs
 *   node scripts/provision-admins.mjs        # prompts for any missing passwords
 */
import fs from "node:fs";
import readline from "node:readline";
import bcrypt from "bcryptjs";

const BCRYPT_COST = 12;

// ── The admin emails to provision (passwords are NEVER stored here) ──────────
const ADMINS = [
  { email: "ben@antimatterai.com",            fullName: "Ben" },
  { email: "josh.mellott@thingktangk.com",    fullName: "Josh Mellott" },
  { email: "joel.bedard@thingktangk.com",     fullName: "Joel Bedard" },
];

// ── CLI flags ────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const tenantArg = args.find((a) => a.startsWith("--tenant="));
const TENANT_SLUG = tenantArg ? tenantArg.split("=")[1] : "antimatter";

// ── Resolve Supabase credentials (env first, then optional keys file) ────────
const clean = (v) => (v || "").replace(/\\n/g, "").trim();
let SUPABASE_URL = clean(process.env.SUPABASE_URL);
let SERVICE_KEY = clean(process.env.SUPABASE_SERVICE_ROLE_KEY);

if (!SUPABASE_URL || !SERVICE_KEY) {
  const keysFile = process.env.SUPABASE_KEYS_FILE || "/home/user/workspace/supabase_keys.txt";
  try {
    const txt = fs.readFileSync(keysFile, "utf-8");
    for (const line of txt.split("\n")) {
      const idxs = [line.indexOf(":"), line.indexOf("=")].filter((i) => i >= 0);
      if (!idxs.length) continue;
      const sep = Math.min(...idxs);
      const k = line.slice(0, sep).trim();
      const v = line.slice(sep + 1).trim();
      if (k === "SUPABASE_URL" && !SUPABASE_URL) SUPABASE_URL = clean(v);
      if (k === "SUPABASE_SERVICE_ROLE_KEY" && !SERVICE_KEY) SERVICE_KEY = clean(v);
    }
  } catch {
    /* no keys file — env vars are the canonical source */
  }
}

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error(
    "✗ Missing Supabase credentials. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY\n" +
      "  (or provide a keys file via SUPABASE_KEYS_FILE)."
  );
  process.exit(1);
}

// ── Supabase REST helper (service role) ──────────────────────────────────────
async function sb(path, init = {}) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
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
  if (!r.ok) throw new Error(`Supabase ${r.status} ${path}: ${t.slice(0, 240)}`);
  return t ? JSON.parse(t) : null;
}

// ── Password resolution: env var per email, else interactive hidden prompt ───
function envVarFor(email) {
  const local = email.split("@")[0];
  return "ADMIN_PW_" + local.toUpperCase().replace(/[^A-Z0-9]+/g, "_");
}

function promptHidden(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const onData = (char) => {
      const c = char.toString();
      if (c === "\n" || c === "\r" || c === "") {
        process.stdin.removeListener("data", onData);
      } else {
        // overwrite the just-typed char so nothing is echoed
        process.stdout.write("\x1b[2K\x1b[200D" + question);
      }
    };
    process.stdout.write(question);
    process.stdin.on("data", onData);
    rl.question("", (answer) => {
      rl.close();
      process.stdout.write("\n");
      resolve(answer);
    });
  });
}

async function resolvePassword(admin) {
  const ev = envVarFor(admin.email);
  const fromEnv = process.env[ev];
  if (fromEnv && fromEnv.length > 0) return fromEnv;
  if (DRY_RUN) return null; // dry-run does not require real passwords
  if (!process.stdin.isTTY) {
    throw new Error(
      `No password for ${admin.email}. Set ${ev} or run interactively (TTY) to be prompted.`
    );
  }
  const pw = await promptHidden(`Password for ${admin.email} (hidden): `);
  if (!pw) throw new Error(`Empty password entered for ${admin.email}`);
  return pw;
}

// ── Main ─────────────────────────────────────────────────────────────────────
(async () => {
  console.log(`ATOM admin provisioner — tenant=${TENANT_SLUG}${DRY_RUN ? " (DRY RUN)" : ""}`);

  const tenants = await sb(
    `tenants?slug=eq.${encodeURIComponent(TENANT_SLUG)}&select=id,slug,name`
  );
  const tenant = tenants && tenants[0];
  if (!tenant) throw new Error(`Tenant '${TENANT_SLUG}' not found`);
  console.log(`✓ Tenant: ${tenant.name} (${tenant.id})`);

  let created = 0;
  let updated = 0;

  for (const admin of ADMINS) {
    const email = admin.email.trim().toLowerCase();
    const password = await resolvePassword(admin);

    if (DRY_RUN) {
      const ev = envVarFor(admin.email);
      const have = !!(process.env[ev] && process.env[ev].length);
      console.log(
        `• ${email} → role=admin, password source: ${have ? ev + " (set)" : ev + " (NOT set — would prompt)"}`
      );
      continue;
    }

    const hash = await bcrypt.hash(password, BCRYPT_COST);
    const now = new Date().toISOString();

    const existing = await sb(
      `tenant_users?tenant_id=eq.${tenant.id}&email=eq.${encodeURIComponent(email)}&select=id,role`
    );

    if (existing && existing.length) {
      await sb(`tenant_users?id=eq.${existing[0].id}`, {
        method: "PATCH",
        body: JSON.stringify({
          password_hash: hash,
          role: "admin",
          full_name: admin.fullName,
          deleted_at: null,
          accepted_at: now, // confirmed — no invite needed
        }),
      });
      updated++;
      console.log(`✓ Updated ${email} (admin)`);
    } else {
      const rows = await sb("tenant_users", {
        method: "POST",
        body: JSON.stringify([
          {
            tenant_id: tenant.id,
            email,
            full_name: admin.fullName,
            role: "admin",
            password_hash: hash,
            invited_at: now,
            accepted_at: now, // already accepted — no email/invite sent
          },
        ]),
      });
      created++;
      console.log(`✓ Created ${email} (admin) ${rows && rows[0] ? rows[0].id : ""}`);
    }
  }

  console.log("──────────────────────────────────────────────");
  if (DRY_RUN) {
    console.log("DRY RUN complete — no writes performed.");
  } else {
    console.log(`Done. created=${created} updated=${updated} (passwords stored as bcrypt hashes only).`);
  }
  console.log(
    "Note: super-admin/platform view is granted to emails in NIRMATA_HQ_EMAILS.\n" +
      "If these admins should have platform-wide (cross-tenant) access, add them there."
  );
})().catch((e) => {
  console.error("✗", e.message);
  process.exit(1);
});
