# ATOM Support — customer-facing AI support agent (v1)

> Enterprise, RAG-grounded support agent for ATOM / AntimatterAI. Floating chat
> widget (marketing + in-app), tenant- and tier-aware tone, citation-backed
> answers, hard-block guardrails, exactly three guarded autonomous actions,
> human escalation, a feedback/eval loop, and an admin command center.
>
> Built to be **Vercel-deployable today** with a clean **live-vs-mock**
> boundary: every external dependency (embeddings, LLM, vector store,
> escalation, email, diagnostics, voice) runs in a deterministic mock mode
> when its credential is absent, so the whole pipeline is testable offline / in
> CI with zero secrets.

---

## 1. What was built

**Four surfaces**
1. **In-app floating widget** — `<AtomSupportWidget surface="app" loggedIn />`, mounted in `client/src/App.tsx` (account-aware, tenant context).
2. **Marketing floating widget** — `<AtomSupportWidget surface="marketing" />`, mounted in `client/src/pages/landing.tsx` (logged-out mode).
3. **Admin / support command center** — `#/admin/support` (super-admin only): overview cards, conversations, escalations, negative feedback, low-confidence, knowledge gaps, action log.
4. **RAG eval page** — the "Eval" tab in the admin center, runs the offline decision-layer harness (no LLM, no secrets) and shows pass/fail.

**Server (2 consolidated Vercel functions, to respect the function-count budget)**
- `api/support.ts` — `op=config|voice|chat|feedback|escalate|action|ingest`. Chat streams via SSE.
- `api/support-admin.ts` — `X-Admin-Key` gated; `view=overview|conversations|conversation|escalations|feedback|low-confidence|knowledge-gaps|actions` + `POST view=eval-run`.
- `api/_lib/support/*` — shared typed library (retrieval, embeddings, LLM, prompt, tone, policies, confidence, escalation, actions, tenant context, diagnostics, voice, eval, ingest).

**Database** — `sql/020-atom-support-tables.sql`: `support_chunks` (pgvector 1024-dim, `tenant_visibility`, `content_type`), `support_conversations`, `support_messages`, `support_feedback`, `support_escalations`, `support_action_log`, plus the `match_support_chunks` cosine RPC. RLS enabled on all tables (service-role only).

## 2. Files changed / added

```
NEW  sql/020-atom-support-tables.sql
NEW  api/support.ts                         # main router (chat SSE, feedback, escalate, action, ingest)
NEW  api/support-admin.ts                    # admin views + eval-run
NEW  api/_lib/support/                       # 23-file typed lib (see directory)
NEW  client/src/components/support/          # widget UI (launcher, panel, message, citations, feedback, voice toggle)
NEW  client/src/pages/support/               # SupportAdminShell.tsx + supportAdminApi.ts
EDIT client/src/App.tsx                      # import + route /admin/support; mount app-surface widget
EDIT client/src/pages/landing.tsx            # mount marketing-surface widget
```

## 3. Environment variables

All are optional. Absent credential → that subsystem runs in **mock** mode (logged, never throws). Set them to go live.

### Already used by the platform (reused, not new)
| Var | Purpose |
|---|---|
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Runtime data layer (all support tables). Without it, conversations/feedback/escalations are not persisted. |
| `ADMIN_API_KEY` | Gates `api/support-admin.ts` and the ingest op (`X-Admin-Key`). |
| `ANTHROPIC_API_KEY` | Preferred LLM (with prompt caching). |
| `OPENAI_API_KEY` | LLM / embedding fallback. |
| `RESEND_API_KEY`, `RESEND_FROM` | Used by the `resend_verification` action. |
| `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT` | Live error signal in tenant-context diagnostics. |
| `APP_URL` / `PUBLIC_APP_URL` | Base URL for links (verification email, etc.). |

### New (ATOM Support specific)
| Var | Default | Purpose |
|---|---|---|
| `EMBEDDING_PROVIDER` | auto | `bge` \| `openai` \| `mock`. Auto-detects from configured keys. |
| `EMBEDDING_MODEL` | `BGE-M3` | Embedding model id (1024-dim). |
| `BGE_EMBED_URL`, `BGE_EMBED_API_KEY` | — | BGE-M3 embedding endpoint. |
| `RAG_URL` | — | Existing atom-rag service (reused if present). |
| `QDRANT_URL`, `QDRANT_API_KEY` | — | Qdrant vector store. If set, used over Supabase pgvector. |
| `QDRANT_COLLECTION_ATOM_SUPPORT` | `atom_support` | Qdrant collection name. |
| `LLM_PROVIDER` | auto | `anthropic` \| `openai` \| `mock`. |
| `LLM_MODEL` | model default | Generation model (the 70B gateway when OpenAI-compatible). |
| `LLM_BASE_URL`, `LLM_API_KEY` | — | OpenAI-compatible 70B gateway. |
| `SUPPORT_ESCALATION_PROVIDER` | auto | `plain` \| `linear` \| `slack` \| `auto`. |
| `SLACK_BOT_TOKEN`, `SLACK_SUPPORT_CHANNEL_ID` | — | Slack escalation ping. |
| `PLAIN_API_KEY` | — | Plain ticket creation. |
| `LINEAR_API_KEY`, `LINEAR_TEAM_ID` | — | Linear issue creation. |
| `ATOM_SUPPORT_CONFIDENCE_THRESHOLD` | `0.7` | Below this → escalate. |
| `ATOM_SUPPORT_ENABLE_ACTIONS` | `false` | Master switch for the 3 autonomous actions. |
| `ATOM_SUPPORT_ENABLE_VOICE` | `false` | Master switch for voice mode (foundation only in v1). |
| `PARAKEET_STT_URL`, `KOKORO_TTS_URL` | — | Voice STT / TTS endpoints (foundation). |

## 4. Run locally

```bash
npm install
npm run dev            # vite + express
# Widget appears bottom-right on the landing page (logged-out) and in-app (logged-in).
```

With **no** secrets set, the widget answers in mock mode and the eval harness passes — good for UI work and CI.

## 5. Ingest the knowledge base

From the admin center → Overview → **"Ingest repo docs"**, or:

```bash
curl -XPOST "$APP_URL/api/support?op=ingest" \
  -H "X-Admin-Key: $ADMIN_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"mode":"repo-defaults"}'
```

Reads `WHITE-LABEL-PLAYBOOK.md`, `docs/*`, `CHANGELOG.md`, `ROADMAP.md`, `README.md` (missing files are skipped), heading-aware chunks them, embeds, and upserts into the active vector store. Each chunk stores source title/URL/heading/chunk-id/timestamp/tenant-visibility/content-type.

## 6. Test the widget / pipeline

- **Marketing**: open `/`, click the bottom-right launcher, ask "What does ATOM do?" → cited answer, thumbs, escalate button.
- **In-app**: log in, the app-surface widget carries tenant context.
- **Decision layers (offline, no secrets)**: admin center → **Eval** tab → Re-run. Or run the harness directly:
  ```bash
  npx tsx -e 'import("./api/_lib/support/evalScenarios").then(m=>{const r=m.runEvalScenarios();console.log(r.passed+"/"+r.total);})'
  ```

## 7. Test tenant context

Logged-in chat injects a **summarized** tenant block only (recent campaign status, coarse usage bucket, billing routing status, recent Sentry error count). Raw DB rows are never sent to the model — see `api/_lib/support/tenantContext.ts`.

## 8. Test the 3 autonomous actions

Set `ATOM_SUPPORT_ENABLE_ACTIONS=true`. The agent proposes; the user confirms in the panel; the server enforces:
1. **resend_verification** — re-sends the verification link (via Resend; logged if no key).
2. **restart_campaign** — only restarts a *stuck* campaign owned by the caller's tenant; anything else is escalated, not forced.
3. **regenerate_api_key** — rotates the key, stores only a `sha256` hash + prefix, returns the plaintext **once**.

Every attempt is authenticated, tenant-authorized, audited to `support_action_log`, and confirm-before-execute. Ambiguous / cross-tenant / destructive → denied + escalated.

## 9. How escalation works

`api/_lib/support/escalationPolicy.ts` (pure, unit-tested via the harness) decides severity from: confidence < threshold, hard-block topics, account-impacting + high tier (Scale/Partner), keyword triggers (lawyer/legal/refund/cancel/chargeback/lawsuit/compliance/HIPAA/PHI/breach/data loss/contract/SLA), angry sentiment, explicit human request, production outage. Routed to Plain / Linear / Slack per `SUPPORT_ESCALATION_PROVIDER`; **always** persisted to `support_escalations` (`provider='logged'` fallback) with transcript + metadata + retrieved docs + confidence + recommended action + severity.

## 10. Mocked vs live

| Subsystem | Live when | Mock behavior |
|---|---|---|
| Embeddings | `BGE_EMBED_URL`/`RAG_URL`/`OPENAI_API_KEY` | Deterministic 1024-dim FNV-hash bag-of-words |
| LLM | `ANTHROPIC_API_KEY` or `LLM_BASE_URL` | Templated grounded answer from retrieved chunks |
| Vector store | `QDRANT_URL` or Supabase pgvector | `none` → retrieval returns [] (answer says so + escalates) |
| Escalation | Slack/Plain/Linear keys | `provider='logged'` row only |
| Email (action) | `RESEND_API_KEY` | Logged, `sent=false` |
| Diagnostics | `SENTRY_*` | Empty error list |
| Voice | `*_URL` + `ENABLE_VOICE` | UI toggle disabled, marked "soon" |

## 11. Security notes

- **No secrets in chat** — actions never echo keys except the one-time API-key plaintext on rotation; only a hash + prefix is stored.
- **Read-only DB by default** — writes happen only inside the three whitelisted action functions; all other DB access is read.
- **Auth + tenant authz** — actions require a resolved session; campaign/key operations verify tenant ownership before mutating.
- **Audit** — every action + escalation is written with actor, tenant, resource, reason, result.
- **No raw rows to the model** — tenant context is a hand-built summary.
- **Hard blocks** — pricing negotiation, refund approval, legal advice, HIPAA/PHI, compliance/security commitments, contract/SLA interpretation are acknowledged, **not** answered substantively, and escalated.
- **Admin endpoints** gated by `ADMIN_API_KEY`; admin UI is `SuperAdminOnly`.
- **RLS** on every support table (service-role only).

## 12. Remaining 2-week launch checklist

1. **Run the migration** `sql/020-atom-support-tables.sql` on prod Supabase; confirm `pgvector` extension + `match_support_chunks` RPC.
2. **Provision embeddings + vector store** (BGE-M3 endpoint or reuse atom-rag; Qdrant collection or pgvector ivfflat index) and **ingest** the KB; spot-check citation quality.
3. **Wire the live LLM** (Anthropic or 70B gateway) and tune `ATOM_SUPPORT_CONFIDENCE_THRESHOLD` against real traffic.
4. **Connect one escalation provider** (Slack first, then Plain/Linear) and verify a real ticket round-trips with transcript + metadata.
5. **Expand the eval set** beyond the 13 seed cases with real questions per tier; add a CI step that runs `runEvalScenarios()`.
6. **Enable actions** (`ATOM_SUPPORT_ENABLE_ACTIONS=true`) only after verifying the verification-email template, campaign-restart state machine, and key-rotation retrieval flow end-to-end in staging.
7. **Add help-center / status / roadmap sources** to the ingest candidate list once those URLs exist.
8. **Voice mode** (optional): stand up Parakeet STT + Kokoro TTS, flip `ATOM_SUPPORT_ENABLE_VOICE`, validate browser mic permissions and the Quest 3S/WebXR path.
9. **Load / abuse test** the marketing widget (rate limiting, prompt-injection probes against the hard-block layer).
10. **Analytics review** in the admin center: watch low-confidence + knowledge-gaps tabs weekly to drive doc improvements.

## Pre-existing build notes

`npm run check` (tsc) reports errors **only in pre-existing files** unrelated to ATOM Support (`bcryptjs` missing types, `downlevelIteration` on Set/Map iteration, `HqShell` lucide icon typing, `App.tsx` `TenantDetailShell` props, `landing.tsx` `DtomHero` props, `product-intel` regex flags). All ~24 new ATOM Support files type-check clean and the production `npm run build` succeeds. Verified the pre-existing errors reproduce on the base commit with the support changes stashed.
