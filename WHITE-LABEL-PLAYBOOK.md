# White-Label GTM Playbook
## Spinning up branded demos without touching core development

> **Pattern**: Each customer demo = its own codebase, its own Git repo, its own Vercel project.
> **Never** create branches off the main dev codebase for customer demos — they rot fast and couple deployments.

---

## 1 · The Tenant Config Pattern

Every white-label build has **one file that drives branding**: `client/src/tenant.config.ts`.

```
intelisys-dominator/
  ├── client/src/tenant.config.ts     ← ONE source of truth
  │   ├── name, fullName, subtitle
  │   ├── colors (primary, accent, surfaces)
  │   ├── fonts
  │   ├── defaultTheme (light | dark)
  │   ├── moduleLabels (renames per tenant)
  │   ├── messaging (subtitles per page)
  │   ├── seedCompanies (demo seed data)
  │   ├── productCategory, targetPersonas
  │   ├── features (toggle per tenant)
  │   └── domain, supportEmail, parentCompany
  └── ...
```

Components **always** import from `@/tenant.config` — never hardcode names, colors, or module labels in component files. This makes future rebrands a 30-minute job, not a 3-day slog.

---

## 2 · The Exact Spin-Up Sequence (30 min per tenant)

### Step 1 — Clone
```bash
cd /home/user/workspace
rsync -a --exclude='node_modules' --exclude='.git' --exclude='dist' --exclude='.vercel' \
  antimatter-dominator/ <tenant>-dominator/

cd <tenant>-dominator
rm -f antimatter.db*
```

### Step 2 — Edit `tenant.config.ts`
Change:
- `name`, `fullName`, `subtitle`, `tagline`, `parent`, `copyright`
- `colors.primary`, `colors.accent` (match the tenant's brand)
- `defaultTheme` (light for most corporate channel/telecom tools, dark for cybersecurity/hacker vibe)
- `moduleLabels` (rename modules in their language: "Partner Dialer" vs "Lead Gen" vs "Outreach Hub")
- `messaging.*` (subtitle copy per module)
- `seedCompanies` (demo accounts relevant to their ICP)
- `productCategory`, `targetPersonas`
- `domain` (the Vercel URL you're deploying to)

### Step 3 — Rewrite `index.css`
Copy the template from `intelisys-dominator/client/src/index.css`.
Change only the **brand token HSLs** under `:root` (light mode) and `.dark` (dark mode).
Use https://hslpicker.com to convert hex → HSL.

### Step 4 — Update `AppLayout.tsx`
- The file already pulls nav labels from `TENANT.moduleLabels` — no changes needed there.
- Replace the `TenantLogo()` component's SVG path data with a new logo (simple inline SVG matching their brand).
- The sidebar can stay dark OR match their theme — just change `background: "#14182a"` if needed.

### Step 5 — Rebrand Pass (automated)
Copy `/home/user/workspace/intelisys-rebrand.py` to a new script for your tenant, edit the replacement pairs, and run:
```bash
python3 <tenant>-rebrand.py
```
This swaps:
- Module name strings ("ATOM War Room" → "Partner War Room")
- Brand color hex codes (crimson → brand primary)
- Font family ("Plus Jakarta Sans" → their font)
- Voice agent names ("ADAM from Antimatter" → "Alex from Intelisys")
- Footer copyright, source branding

### Step 6 — Seed Demo Data
Edit `App.tsx` `seedDemoData()` function with 4–6 relevant accounts for their industry.
Use real-sounding companies, real-sounding stakeholders, realistic signals (funding, leadership changes, tech changes).

### Step 7 — Update `index.html`
- Change `<title>` to their product name
- Replace favicon SVG with their brand mark (inline SVG data URL)
- Update `<meta name="description">`

### Step 8 — Rename `package.json`
```json
{
  "name": "<tenant>-sales-copilot",
  "description": "..."
}
```

### Step 9 — Fresh Git + New GitHub Repo
```bash
rm -rf .vercel .git
git init -q
git add -A
git commit -m "Initial <Tenant> Sales Copilot — white-label build"
gh repo create <tenant>-sales-copilot --private --source=. --remote=origin --push
```

### Step 10 — New Vercel Project
```bash
# Replace antimatter env vars (Apollo, Perplexity, OpenAI, Hume, PDL, Hunter, Twilio)
# The demo will still work against your existing API keys — or issue sandbox keys per tenant
NODE_TLS_REJECT_UNAUTHORIZED=0 npx vercel deploy --prod --yes --force \
  --name <tenant>-sales-copilot
```

Vercel will prompt to link to the GitHub repo — link it, and every future push auto-deploys.

### Step 11 — Custom Domain (optional)
Once the demo wins the deal:
- Buy/transfer their demo subdomain (e.g. `copilot.intelisys.com`)
- Add it in Vercel → Settings → Domains
- They get a branded URL on their own domain

---

## 3 · Keeping Development & Demos Separate

| Concern | Solution |
|---------|----------|
| **Main dev codebase** | `antimatter-dominator/` — only you touch this. All new features land here first. |
| **Tenant demos** | `<tenant>-dominator/` — frozen snapshots. Never rebase onto main dev. |
| **Need to push a feature to a tenant?** | Cherry-pick specific commits via `git format-patch` + `git am`, or manually copy the file. |
| **Shared API keys across demos?** | Yes — same Apollo/Perplexity/OpenAI keys work for all tenants. You control rate limits via Vercel env. |
| **Different API key per tenant?** | Each Vercel project has its own env vars. Issue sandbox keys per tenant if needed for commercial deals. |
| **Tenant reports a bug in their demo** | Fix it in their `<tenant>-dominator/` repo only. Don't back-port unless the bug affects main dev too. |

---

## 4 · Commercial Progression (from demo → SaaS)

1. **Demo stage** (0–2 weeks) — Static white-label on `<tenant>.vercel.app`
2. **Pilot stage** (2–6 weeks) — Add their real data via CSV import + custom prompts in their tenant config
3. **Contract stage** — Move to their own Vercel/AWS, transfer GitHub ownership OR keep hosted
4. **Multi-tenant SaaS stage** (future) — When you have 5+ tenants, fold tenant.config into a database-backed tenancy system

For early deals (< 10 tenants), **the clone pattern wins**. It's infinitely simpler than building a multi-tenant DB + auth system before you need one.

---

## 5 · File-by-File Checklist per Tenant

- [ ] `client/src/tenant.config.ts` — brand, colors, copy, features
- [ ] `client/src/index.css` — brand color HSLs in `:root` and `.dark`
- [ ] `client/src/components/AppLayout.tsx` — logo SVG
- [ ] `client/src/App.tsx` — `seedDemoData()` with industry-relevant accounts
- [ ] `client/index.html` — title, favicon, meta description
- [ ] `package.json` — name, description
- [ ] Run rebrand script to swap remaining hardcoded strings
- [ ] Fresh git + new GitHub private repo
- [ ] New Vercel project, configure env vars
- [ ] QA screenshots — War Room, Pitch, Prospect, Campaign
- [ ] Share URL with customer + record a 3-min walkthrough

---

## 6 · Active Tenants

| Tenant | Codebase Path | GitHub | Vercel URL | Status |
|--------|---------------|--------|-----------|--------|
| **Antimatter AI (dev)** | `antimatter-dominator/` | `antimatter-dominator` | `atom-dominator-pro.vercel.app` | **Primary dev** |
| **Intelisys / ScanSource** | `intelisys-dominator/` | `intelisys-sales-copilot` | `intelisys-sales-copilot.vercel.app` | Demo · white-label v1 |
