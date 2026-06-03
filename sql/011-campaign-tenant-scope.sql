-- ────────────────────────────────────────────────────────────────────
-- 011: Tenant-scope atom_campaigns
--
-- The campaigns API (api/campaigns/index.ts, api/campaigns/[id]/index.ts)
-- now filters every read/write by the caller's tenant_id so campaigns
-- cannot cross tenants. This adds the column required for that scoping.
--
-- Idempotent — safe to re-run.
-- ────────────────────────────────────────────────────────────────────

alter table atom_campaigns
  add column if not exists tenant_id uuid references tenants(id);

create index if not exists atom_campaigns_tenant_id_idx
  on atom_campaigns (tenant_id);

-- NOTE: pre-existing rows have tenant_id = NULL and will therefore be
-- invisible to the now tenant-scoped API. Backfill them to the correct
-- owning tenant before relying on the scoped endpoints, e.g.:
--
--   update atom_campaigns set tenant_id = '<tenant-uuid>' where tenant_id is null;
--
-- Once backfilled, consider enforcing NOT NULL:
--   alter table atom_campaigns alter column tenant_id set not null;
