import { useState, useEffect, useMemo, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Plus, Upload, FileSpreadsheet, Zap, ListChecks, ArrowRight,
  Trash2, Sparkles, Send, Loader2, CheckCircle2, Target,
} from "lucide-react";

// ────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────
type Campaign = {
  id: number;
  name: string;
  productSlug: string;
  productLabel: string;
  scoringTemplateSlug: string;
  status: "draft" | "scoring" | "enriching" | "ready";
  totalAccounts: number;
  scoredAccounts: number;
  enrichedAccounts: number;
  createdAt: string;
  updatedAt: string;
  counts?: { total: number; scored: number; enriched: number };
};

type CampaignAccount = {
  id: number;
  accountName: string;
  domain: string | null;
  state: string | null;
  subVertical: string | null;
  revenue: number | null;
  akafit: string | null;
  walletGrade: string | null;
  publicSubtotal: number;
  finalScore: number;
  tier: string | null;
  whyNow: string | null;
  enrichStatus: string;
  scoreRegulatory: number;
  scoreAccountFit: number;
  scoreListDensity: number;
  scoreSegmentation: number;
  scoreAtomIntent: number;
  scoreAtomPersonas: number;
  scoreAtomFreshness: number;
};

type ScoringTemplate = { id: number; slug: string; name: string; description: string };

// ────────────────────────────────────────────────────────────────────────────
// CSV parsing (simple — handles quoted fields w/ commas)
// ────────────────────────────────────────────────────────────────────────────
function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') inQuotes = false;
      else cur += ch;
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === ",") { row.push(cur); cur = ""; }
      else if (ch === "\n") { row.push(cur); rows.push(row); row = []; cur = ""; }
      else if (ch === "\r") { /* skip */ }
      else cur += ch;
    }
  }
  if (cur.length || row.length) { row.push(cur); rows.push(row); }
  return rows.filter((r) => r.length > 1 || (r.length === 1 && r[0].trim()));
}

const FIELD_LABELS: Record<string, string> = {
  accountName: "Account Name *",
  domain: "Domain",
  state: "State",
  subVertical: "Sub-Vertical",
  revenue: "Revenue (USD)",
  akafit: "AkaFit (A/B/C)",
  walletGrade: "Wallet Grade",
  targetLists: "Target Lists",
};

const FIELD_ORDER = ["accountName", "domain", "state", "subVertical", "revenue", "akafit", "walletGrade", "targetLists"];

function guessMapping(headers: string[]): Record<string, number> {
  const map: Record<string, number> = {};
  const lower = headers.map((h) => h.toLowerCase().trim());
  const find = (...keys: string[]) => {
    for (const k of keys) {
      const idx = lower.findIndex((h) => h.includes(k));
      if (idx >= 0) return idx;
    }
    return -1;
  };
  map.accountName = find("account name", "company", "account");
  map.domain = find("domain", "website", "url");
  map.state = find("state", "region");
  map.subVertical = find("sub-vertical", "sub vertical", "subvertical", "vertical");
  map.revenue = find("revenue");
  map.akafit = find("akafit", "fit");
  map.walletGrade = find("wallet");
  map.targetLists = find("target list", "tal", "lists");
  return map;
}

function tierColor(tier: string | null): string {
  switch (tier) {
    case "T1": return "bg-[#3e3f7e] text-white border-[#4c4dac]";
    case "T2": return "bg-[#4c4dac] text-white border-[#696aac]";
    case "T3": return "bg-[#696aac]/30 text-[#c7c8f2] border-[#696aac]";
    default: return "bg-white/5 text-white/50 border-white/10";
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Main page
// ────────────────────────────────────────────────────────────────────────────
export default function Campaigns() {
  const [view, setView] = useState<"list" | "detail">("list");
  const [activeId, setActiveId] = useState<number | null>(null);
  const [wizardOpen, setWizardOpen] = useState(false);

  const { data: campaigns, isLoading } = useQuery<Campaign[]>({
    queryKey: ["/api/campaigns"],
    queryFn: async () => (await apiRequest("GET", "/api/campaigns")).json(),
  });

  return (
    <div className="min-h-screen bg-[#020202] text-[#f6f6fd] p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
              <ListChecks className="w-8 h-8 text-[#a2a3e9]" />
              ΔTOM Campaigns
            </h1>
            <p className="text-[#a2a3e9]/70 mt-2 text-sm">
              Bulk import → score → enrich → push. Three minutes from CSV to engaged pipeline.
            </p>
          </div>
          {view === "list" && (
            <Button
              onClick={() => setWizardOpen(true)}
              className="bg-[#3e3f7e] hover:bg-[#4c4dac] text-white"
              data-testid="button-new-campaign"
            >
              <Plus className="w-4 h-4 mr-2" /> New Campaign
            </Button>
          )}
        </div>

        {view === "list" && (
          <CampaignList
            campaigns={campaigns}
            isLoading={isLoading}
            onOpen={(id) => { setActiveId(id); setView("detail"); }}
          />
        )}
        {view === "detail" && activeId != null && (
          <CampaignDetail id={activeId} onBack={() => setView("list")} />
        )}

        <NewCampaignWizard
          open={wizardOpen}
          onClose={() => setWizardOpen(false)}
          onCreated={(id) => { setWizardOpen(false); setActiveId(id); setView("detail"); }}
        />
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// List view
// ────────────────────────────────────────────────────────────────────────────
function CampaignList({
  campaigns, isLoading, onOpen,
}: { campaigns?: Campaign[]; isLoading: boolean; onOpen: (id: number) => void }) {
  if (isLoading) {
    return <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {[1, 2, 3].map((i) => <Skeleton key={i} className="h-40 bg-white/5" />)}
    </div>;
  }
  if (!campaigns?.length) {
    return (
      <Card className="bg-[#0a0a1a]/50 border-[#3e3f7e]/30">
        <CardContent className="py-16 text-center">
          <Target className="w-12 h-12 mx-auto text-[#696aac] mb-4" />
          <h3 className="text-xl font-semibold mb-2">No campaigns yet</h3>
          <p className="text-[#a2a3e9]/60 mb-6 max-w-md mx-auto">
            Drop a target list, pick a scoring template, and ΔTOM turns hundreds of accounts into a tiered battle plan.
          </p>
        </CardContent>
      </Card>
    );
  }
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {campaigns.map((c) => (
        <Card
          key={c.id}
          className="bg-[#0a0a1a]/60 border-[#3e3f7e]/30 hover:border-[#4c4dac] transition-all cursor-pointer"
          onClick={() => onOpen(c.id)}
          data-testid={`card-campaign-${c.id}`}
        >
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-base text-[#f6f6fd]">{c.name}</CardTitle>
                <CardDescription className="text-xs text-[#a2a3e9]/70 mt-1">
                  {c.productLabel}
                </CardDescription>
              </div>
              <Badge className={
                c.status === "ready" ? "bg-[#3e3f7e] text-white"
                : c.status === "enriching" ? "bg-[#4c4dac] text-white"
                : c.status === "scoring" ? "bg-[#696aac] text-white"
                : "bg-white/10 text-[#a2a3e9]"
              }>
                {c.status}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <div className="text-2xl font-bold text-[#c7c8f2]">{c.counts?.total ?? c.totalAccounts}</div>
                <div className="text-[10px] text-[#a2a3e9]/60 uppercase tracking-wider">Total</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-[#a2a3e9]">{c.counts?.scored ?? c.scoredAccounts}</div>
                <div className="text-[10px] text-[#a2a3e9]/60 uppercase tracking-wider">Scored</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-[#e3e3f8]">{c.counts?.enriched ?? c.enrichedAccounts}</div>
                <div className="text-[10px] text-[#a2a3e9]/60 uppercase tracking-wider">Enriched</div>
              </div>
            </div>
            <Button variant="ghost" size="sm" className="w-full mt-3 text-[#a2a3e9] hover:text-white hover:bg-[#3e3f7e]/20">
              Open <ArrowRight className="w-3 h-3 ml-1" />
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// New-campaign wizard
// ────────────────────────────────────────────────────────────────────────────
function NewCampaignWizard({
  open, onClose, onCreated,
}: { open: boolean; onClose: () => void; onCreated: (id: number) => void }) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [name, setName] = useState("");
  const [productLabel, setProductLabel] = useState("Akamai Guardicore Segmentation");
  const [productSlug, setProductSlug] = useState("akamai-guardicore");
  const [templateSlug, setTemplateSlug] = useState("healthcare-segmentation-hipaa");
  const [csvRows, setCsvRows] = useState<string[][]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string, number>>({});
  const fileRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: templates } = useQuery<ScoringTemplate[]>({
    queryKey: ["/api/scoring-templates"],
    queryFn: async () => (await apiRequest("GET", "/api/scoring-templates")).json(),
    enabled: open,
  });

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      const rows = parseCSV(String(reader.result || ""));
      if (rows.length < 2) {
        toast({ title: "Empty file", description: "Need at least a header row + 1 data row.", variant: "destructive" });
        return;
      }
      setHeaders(rows[0].map((h) => h.trim()));
      setCsvRows(rows.slice(1));
      setMapping(guessMapping(rows[0]));
      setStep(2);
    };
    reader.readAsText(f);
  }

  async function submit() {
    try {
      // 1. Create campaign
      const camp = await (await apiRequest("POST", "/api/campaigns", {
        name, productSlug, productLabel, scoringTemplateSlug: templateSlug,
      })).json();
      // 2. Build accounts array using mapping
      const accounts = csvRows.map((r) => {
        const get = (key: string) => {
          const idx = mapping[key];
          return idx != null && idx >= 0 ? (r[idx] || "").trim() : "";
        };
        const revStr = get("revenue").replace(/[$,]/g, "");
        const rev = revStr ? Number(revStr) : null;
        const targetLists = get("targetLists");
        return {
          accountName: get("accountName"),
          domain: get("domain") || null,
          state: get("state") || null,
          subVertical: get("subVertical") || null,
          revenue: rev && !isNaN(rev) ? rev : null,
          akafit: get("akafit") || null,
          walletGrade: get("walletGrade") || null,
          extraTags: targetLists ? { target_lists: targetLists } : undefined,
        };
      }).filter((a) => a.accountName);
      // 3. Import
      await apiRequest("POST", `/api/campaigns/${camp.id}/import`, { accounts });
      // 4. Score
      await apiRequest("POST", `/api/campaigns/${camp.id}/score-public`, {});
      qc.invalidateQueries({ queryKey: ["/api/campaigns"] });
      toast({ title: "Campaign live", description: `${accounts.length} accounts imported + scored.` });
      onCreated(camp.id);
      // reset
      setStep(1); setName(""); setCsvRows([]); setHeaders([]); setMapping({});
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  }

  const mappingValid = mapping.accountName != null && mapping.accountName >= 0;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bg-[#0a0a1a] border-[#3e3f7e] text-[#f6f6fd] max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-[#c7c8f2]">New ΔTOM Campaign — Step {step} of 3</DialogTitle>
          <DialogDescription className="text-[#a2a3e9]/70">
            {step === 1 && "Name your campaign and pick a scoring template."}
            {step === 2 && "Map your CSV columns to ΔTOM fields. We auto-guess."}
            {step === 3 && "Review and launch."}
          </DialogDescription>
        </DialogHeader>

        {step === 1 && (
          <div className="space-y-4">
            <div>
              <Label className="text-[#a2a3e9]">Campaign name</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Akamai × Guardicore HIPAA Q2"
                className="bg-[#020202] border-[#3e3f7e] mt-1"
                data-testid="input-campaign-name"
              />
            </div>
            <div>
              <Label className="text-[#a2a3e9]">Product</Label>
              <Input
                value={productLabel}
                onChange={(e) => setProductLabel(e.target.value)}
                className="bg-[#020202] border-[#3e3f7e] mt-1"
                data-testid="input-product-label"
              />
            </div>
            <div>
              <Label className="text-[#a2a3e9]">Scoring template</Label>
              <Select value={templateSlug} onValueChange={setTemplateSlug}>
                <SelectTrigger className="bg-[#020202] border-[#3e3f7e] mt-1" data-testid="select-template">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#0a0a1a] border-[#3e3f7e]">
                  {(templates || []).map((t) => (
                    <SelectItem key={t.slug} value={t.slug}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[#a2a3e9]">Upload CSV</Label>
              <input
                type="file"
                accept=".csv,text/csv"
                ref={fileRef}
                onChange={handleFile}
                className="hidden"
              />
              <Button
                variant="outline"
                className="w-full mt-1 border-dashed border-[#3e3f7e] hover:border-[#4c4dac] bg-transparent h-24"
                onClick={() => fileRef.current?.click()}
                disabled={!name}
                data-testid="button-upload-csv"
              >
                <Upload className="w-5 h-5 mr-2" />
                {name ? "Click to upload CSV" : "Enter a name first"}
              </Button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3 max-h-96 overflow-y-auto">
            <div className="text-xs text-[#a2a3e9]/70 mb-2">
              Detected {csvRows.length} rows. Map each ΔTOM field to a CSV column.
            </div>
            {FIELD_ORDER.map((field) => (
              <div key={field} className="flex items-center gap-3">
                <Label className="w-40 text-sm text-[#a2a3e9]">{FIELD_LABELS[field]}</Label>
                <Select
                  value={mapping[field] != null && mapping[field] >= 0 ? String(mapping[field]) : "_none"}
                  onValueChange={(v) => setMapping({ ...mapping, [field]: v === "_none" ? -1 : Number(v) })}
                >
                  <SelectTrigger className="flex-1 bg-[#020202] border-[#3e3f7e]" data-testid={`select-map-${field}`}>
                    <SelectValue placeholder="— skip —" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#0a0a1a] border-[#3e3f7e]">
                    <SelectItem value="_none">— skip —</SelectItem>
                    {headers.map((h, i) => <SelectItem key={i} value={String(i)}>{h}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>
        )}

        {step === 3 && (
          <div className="space-y-3 text-sm">
            <Card className="bg-[#020202] border-[#3e3f7e]/50">
              <CardContent className="pt-4 space-y-2">
                <div><span className="text-[#a2a3e9]/60">Name:</span> <span className="text-white">{name}</span></div>
                <div><span className="text-[#a2a3e9]/60">Product:</span> <span className="text-white">{productLabel}</span></div>
                <div><span className="text-[#a2a3e9]/60">Template:</span> <span className="text-white">{templateSlug}</span></div>
                <div><span className="text-[#a2a3e9]/60">Rows to import:</span> <span className="text-white font-bold">{csvRows.length}</span></div>
                <div><span className="text-[#a2a3e9]/60">Mapped fields:</span> <span className="text-white">{Object.values(mapping).filter((v) => v >= 0).length}</span></div>
              </CardContent>
            </Card>
            <div className="text-xs text-[#a2a3e9]/60">
              On launch: rows will be imported, the public-signal scorer runs immediately (sub-second per row), and you'll land on the campaign detail page where you can fire ΔTOM enrichment on any rows you want.
            </div>
          </div>
        )}

        <DialogFooter>
          {step > 1 && <Button variant="outline" onClick={() => setStep((s) => (s - 1) as any)} className="border-[#3e3f7e]">Back</Button>}
          {step === 2 && (
            <Button
              onClick={() => setStep(3)}
              disabled={!mappingValid}
              className="bg-[#3e3f7e] hover:bg-[#4c4dac]"
              data-testid="button-wizard-next"
            >
              Next <ArrowRight className="w-3 h-3 ml-1" />
            </Button>
          )}
          {step === 3 && (
            <Button onClick={submit} className="bg-[#3e3f7e] hover:bg-[#4c4dac]" data-testid="button-wizard-launch">
              <Zap className="w-4 h-4 mr-2" /> Launch Campaign
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Detail view
// ────────────────────────────────────────────────────────────────────────────
function CampaignDetail({ id, onBack }: { id: number; onBack: () => void }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [tierFilter, setTierFilter] = useState<string>("ALL");
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const { data: campaign } = useQuery<Campaign>({
    queryKey: [`/api/campaigns/${id}`],
    queryFn: async () => (await apiRequest("GET", `/api/campaigns/${id}`)).json(),
    refetchInterval: 5000,
  });
  const { data: accounts, isLoading } = useQuery<CampaignAccount[]>({
    queryKey: [`/api/campaigns/${id}/accounts`, tierFilter],
    queryFn: async () => {
      const q = tierFilter !== "ALL" ? `?tier=${tierFilter}` : "";
      return (await apiRequest("GET", `/api/campaigns/${id}/accounts${q}`)).json();
    },
    refetchInterval: 5000,
  });

  const enrichMutation = useMutation({
    mutationFn: async (ids: number[]) =>
      (await apiRequest("POST", `/api/campaigns/${id}/enrich`, { accountIds: ids })).json(),
    onSuccess: (res) => {
      toast({ title: "Enrichment queued", description: `${res.queued} accounts → ATOM enrichment running.` });
      qc.invalidateQueries({ queryKey: [`/api/campaigns/${id}/accounts`] });
      setSelected(new Set());
    },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const pushMutation = useMutation({
    mutationFn: async (target: string) =>
      (await apiRequest("POST", `/api/campaigns/${id}/push`, { accountIds: Array.from(selected), target })).json(),
    onSuccess: (res) => {
      toast({ title: "Pushed", description: `${res.pushed} accounts → ${res.target}.` });
      setSelected(new Set());
    },
  });

  const tierCounts = useMemo(() => {
    const c = { T1: 0, T2: 0, T3: 0, T4: 0 };
    (accounts || []).forEach((a) => { if (a.tier && c[a.tier as keyof typeof c] != null) c[a.tier as keyof typeof c]++; });
    return c;
  }, [accounts]);

  const allSelected = (accounts?.length || 0) > 0 && selected.size === accounts!.length;
  const toggleAll = () => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set((accounts || []).map((a) => a.id)));
  };
  const toggleOne = (aid: number) => {
    const next = new Set(selected);
    if (next.has(aid)) next.delete(aid); else next.add(aid);
    setSelected(next);
  };

  return (
    <div>
      <div className="flex items-start justify-between mb-4">
        <div>
          <Button variant="ghost" onClick={onBack} className="mb-2 text-[#a2a3e9] hover:text-white hover:bg-[#3e3f7e]/20 -ml-2">
            ← Back to campaigns
          </Button>
          <h2 className="text-2xl font-bold">{campaign?.name}</h2>
          <p className="text-sm text-[#a2a3e9]/70">{campaign?.productLabel}</p>
        </div>
        <div className="flex gap-2">
          <Button
            disabled={selected.size === 0 || enrichMutation.isPending}
            onClick={() => enrichMutation.mutate(Array.from(selected))}
            className="bg-[#3e3f7e] hover:bg-[#4c4dac]"
            data-testid="button-enrich-selected"
          >
            {enrichMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
            Enrich {selected.size > 0 && `(${selected.size})`}
          </Button>
          <Button
            disabled={selected.size === 0}
            onClick={() => pushMutation.mutate("prospects")}
            variant="outline"
            className="border-[#3e3f7e] hover:bg-[#3e3f7e]/20"
            data-testid="button-push-selected"
          >
            <Send className="w-4 h-4 mr-2" /> Push to Prospects
          </Button>
        </div>
      </div>

      {/* Tier filter chips */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {(["ALL", "T1", "T2", "T3", "T4"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTierFilter(t)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
              tierFilter === t
                ? "bg-[#3e3f7e] text-white border-[#4c4dac]"
                : "bg-transparent text-[#a2a3e9] border-[#3e3f7e]/40 hover:border-[#4c4dac]"
            }`}
            data-testid={`chip-tier-${t}`}
          >
            {t} {t !== "ALL" && <span className="ml-1 opacity-70">{tierCounts[t as keyof typeof tierCounts]}</span>}
          </button>
        ))}
      </div>

      {/* Accounts table */}
      <Card className="bg-[#0a0a1a]/60 border-[#3e3f7e]/30">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-[#a2a3e9]/60"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>
          ) : !accounts?.length ? (
            <div className="p-8 text-center text-[#a2a3e9]/60">No accounts matching this filter.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#3e3f7e]/30 text-[10px] uppercase tracking-wider text-[#a2a3e9]/60">
                    <th className="p-2"><input type="checkbox" checked={allSelected} onChange={toggleAll} /></th>
                    <th className="p-2 text-left">Account</th>
                    <th className="p-2 text-left">State</th>
                    <th className="p-2 text-left">Sub-Vertical</th>
                    <th className="p-2 text-right">Score</th>
                    <th className="p-2 text-center">Tier</th>
                    <th className="p-2 text-left">Why Now</th>
                    <th className="p-2 text-center">Enrich</th>
                  </tr>
                </thead>
                <tbody>
                  {accounts.map((a) => (
                    <tr key={a.id} className="border-b border-[#3e3f7e]/10 hover:bg-[#3e3f7e]/10">
                      <td className="p-2"><input type="checkbox" checked={selected.has(a.id)} onChange={() => toggleOne(a.id)} data-testid={`checkbox-account-${a.id}`} /></td>
                      <td className="p-2 font-medium text-white">{a.accountName}</td>
                      <td className="p-2 text-[#a2a3e9]/70">{a.state || "—"}</td>
                      <td className="p-2 text-[#a2a3e9]/70 text-xs">{a.subVertical || "—"}</td>
                      <td className="p-2 text-right font-bold text-[#c7c8f2]">{Math.round(a.finalScore || a.publicSubtotal || 0)}</td>
                      <td className="p-2 text-center">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold border ${tierColor(a.tier)}`}>
                          {a.tier || "—"}
                        </span>
                      </td>
                      <td className="p-2 text-xs text-[#a2a3e9]/70 max-w-md truncate">{a.whyNow || ""}</td>
                      <td className="p-2 text-center text-xs">
                        {a.enrichStatus === "done" ? <CheckCircle2 className="w-4 h-4 text-[#a2a3e9] mx-auto" />
                          : a.enrichStatus === "running" ? <Loader2 className="w-4 h-4 animate-spin mx-auto text-[#696aac]" />
                          : a.enrichStatus === "failed" ? <span className="text-red-400">!</span>
                          : <span className="text-[#a2a3e9]/40">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
