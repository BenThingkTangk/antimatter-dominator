# ATOM Researcher Pro / Sonar

Vibranium-tier deep-research worker. Generates source-backed, sales-actionable,
executive-grade dossiers for any company/contact target using **Perplexity Sonar**
server-side. Citation-backed, with buying-signal detection, competitive context,
and a ready-to-use call strategy.

- **Page (UI):** `/#/researcher` → `client/src/pages/atom-researcher.tsx`
- **API (prod, Vercel):** `POST /api/atom-researcher` → `api/atom-researcher.ts`
- **API (dev, Express):** same path, registered in `server/routes.ts`
- **Engine (shared):** `api/_lib/atom-researcher.ts`
- **Nav:** sidebar "ΔTOM Researcher Pro" + Command Palette ("researcher / sonar")

## Request

```
POST /api/atom-researcher
Content-Type: application/json

{
  "companyName": "Cloudflare",
  "domain": "cloudflare.com",
  "contactName": "Matthew Prince",
  "contactTitle": "Co-founder & CEO",
  "linkedinUrl": "https://www.linkedin.com/in/mjprince/",
  "salesObjective": "Position ATOM as the edge-native AI voice & deep-research layer",
  "offering": "ATOM Sales OS — autonomous AI voice agent + Vibranium deep research",
  "competitor": "Akamai (edge), 11x.ai, Bland AI",
  "notes": "Pre-call brief for a strategic partnership conversation.",
  "mode": "vibranium_war_room"
}
```

`mode` ∈ `fast_scan` | `pro_dossier` | `deep_research` | `vibranium_war_room`.
One of `companyName` or `domain` is required.

## Response

```jsonc
{
  "ok": true,
  "researchId": "atomr_…",
  "mode": "vibranium_war_room",
  "model": "sonar-pro",
  "latencyMs": 42310,
  "rawMarkdown": "## 1. Executive Brief …",      // original model output
  "dossier": {
    "company": "Cloudflare",
    "confidence": 82,
    "confidenceLabel": "High",
    "sourceThin": false,
    "executiveBrief": "…",
    "sections": [ { "id": "executive-brief", "title": "1. Executive Brief", "markdown": "…" }, … ],
    "buyingSignals": [ { "category": "Funding", "detected": false, "detail": "…" }, … ],
    "sourceMap": [ { "index": 1, "url": "…", "domain": "sec.gov", "quality": 95, "tier": "primary" }, … ],
    "generatedAt": "2026-06-03T…Z"
  }
}
```

Errors: `{ "ok": false, "error": "...", "details": "..." }` with status:
- `503 perplexity_not_configured` — key missing (UI shows the activation state)
- `400 missing_target` — no company/domain
- `502 perplexity_error` / `empty_response` — upstream issue
- `504 timeout`

## Dossier sections (12, fixed order)

Executive Brief · Company Snapshot · Recent Developments · Buying Signals ·
Pain Points · Contact / Persona Brief · Competitive Context · Strategic Fit ·
Call Strategy · Outreach Angles · Confidence + Gaps · Source Map.

## Mode → model strategy

| Mode | Model | Search depth | Recency | Max tokens |
|---|---|---|---|---|
| `fast_scan` | `sonar` | low | month | 2200 |
| `pro_dossier` | `PERPLEXITY_MODEL_RESEARCH` ?? `sonar-pro` | high | month | 3400 |
| `deep_research` | `PERPLEXITY_MODEL_RESEARCH` ?? `sonar-pro` | high | month | 4200 |
| `vibranium_war_room` | `PERPLEXITY_MODEL_RESEARCH` ?? `sonar-pro` | high | week | 5000 |

## Environment variables

| Var | Required | Purpose | Where to get it |
|---|---|---|---|
| `PERPLEXITY_API_KEY` | **Yes** | Server-side Sonar auth. Never exposed to the client. Without it the API returns `503` and the UI shows: *"PERPLEXITY_API_KEY is not configured. Add it to your server environment to activate live Sonar research."* | Perplexity dashboard → API Keys |
| `PERPLEXITY_MODEL_RESEARCH` | No | Overrides the model used by the three deep tiers. Falls back to `sonar-pro`. Set to a heavier Sonar model when available. | Perplexity model catalog |
| `SUPABASE_URL` | No | Enables durable cross-device dossier history (table `atom_research_dossiers`). | Supabase project settings |
| `SUPABASE_SERVICE_ROLE_KEY` | No | Service-role key for the same. | Supabase project settings |

Set in the Vercel project (Production + Preview) and in your local `.env` / shell
for dev (`NODE_ENV=development tsx server/index.ts`).

### Local dev
```bash
export PERPLEXITY_API_KEY=pplx-xxxxxxxx
# optional
export PERPLEXITY_MODEL_RESEARCH=sonar-pro
npm run dev      # serves UI + /api on :5000
```

## Persistence

- **Always on:** client-side history (`localStorage` key `atom_research_dossiers_v1`,
  capped at 25, with an in-memory fallback if storage is blocked).
- **Optional durable:** when Supabase env is set, each dossier is also written to
  `atom_research_dossiers` (best-effort, never blocks the response). Schema:
  `sql/011-atom-research-dossiers.sql`.

## Testing the Cloudflare Vibranium War Room input

1. Open `/#/researcher`.
2. Click **Load Demo** → fills the exact Cloudflare War Room brief
   (mode = `vibranium_war_room`).
3. Click **Run ATOM Research**.
4. Watch the live status stages, then review the dossier tabs, Buying Signal
   Radar, Call Brief card, Source Map (quality-scored), and confidence meter.
5. Export via **Copy / .md / .json**. (PDF is intentionally disabled — "coming soon".)

If `PERPLEXITY_API_KEY` is unset you'll see the polished activation state instead
of a dossier — expected.

## Citations & source map (robust extraction)

Perplexity Sonar returns sources in several shapes depending on tier/model:
`citations` may be a `string[]` (legacy) **or** an object array
(`{ url, title, date }`), and newer tiers also return a separate
`search_results` object array. `harvestCitations()` consumes **all** of these,
dedupes by URL, and preserves order — so the source map is populated even when
the model writes inline `[1]…[n]` markers but no literal URLs in the prose.

- **Clickable sources always render.** Numeric `[n]` chips in the dossier map to
  the corresponding `sourceMap[n]` URL; the Source Map tab lists title, domain,
  date, tier, and a quality bar.
- **Export integrity.** If the model's `## 12. Source Map` section lacks real
  URLs but the API returned citations, `ensureSourceMapMarkdown()` appends a
  generated, fully-linked Source Map to `rawMarkdown` so `.md` / copy exports
  always carry real URLs. A pre-linked source map is left untouched.
- **`dossier.confidenceScore`** is always populated as a number (alias of
  `confidence`), alongside `confidenceLabel` and `sourceCount`, per the public
  contract.
- No URLs are ever fabricated — only URLs the API actually returned (or that the
  model literally wrote) are surfaced.

Offline verification: `npx tsx scripts/atom-researcher-smoke.ts` exercises the
object-citation, `search_results`, URL-less-source-map, legacy `string[]`, and
source-thin paths with no network or API key.

## Guardrails

- API key is server-side only; the browser never sees it.
- Citations come from Perplexity's `citations` **and** `search_results` (no
  fabricated URLs); the source map is quality-scored (primary / credible /
  secondary) with a recency nudge for recently-dated sources.
- Source-thin (<3 sources) dossiers are flagged and confidence is capped at 55.
- Confidence + Gaps section separates verified vs inferred; the system prompt
  forbids invented facts.
- Malformed upstream responses are handled (empty body, non-JSON, timeout).
- Fully responsive; accessibility labels on inputs and mode cards.
