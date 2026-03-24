import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { store, useProspects, type Prospect } from "@/lib/store";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Radar, Loader2, Signal, ChevronDown, ChevronUp, Flame } from "lucide-react";
import type { Product } from "@shared/schema";

const scanIndustries = ["All Industries","Healthcare & Life Sciences","Financial Services & Banking","Real Estate & PropTech","Defense & Government","Technology & SaaS","Insurance","Manufacturing","Retail & E-Commerce"];
const urgencyColors: Record<string, string> = { critical: "bg-rose-500/15 text-rose-500", high: "bg-amber-500/15 text-amber-500", medium: "bg-blue-500/15 text-blue-500", low: "bg-muted text-muted-foreground" };
const statusColors: Record<string, string> = { new: "bg-primary/15 text-primary", contacted: "bg-blue-500/15 text-blue-500", engaged: "bg-amber-500/15 text-amber-500", qualified: "bg-emerald-500/15 text-emerald-500", closed: "bg-muted text-muted-foreground" };

function ScoreBar({ score }: { score: number }) {
  const color = score >= 80 ? "bg-rose-500" : score >= 60 ? "bg-amber-500" : "bg-blue-500";
  return (
    <div className="flex items-center gap-2 w-full">
      <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden"><div className={`h-full rounded-full ${color}`} style={{ width: `${score}%` }} /></div>
      <span className={`text-xs font-bold tabular-nums ${score >= 80 ? "text-rose-500" : score >= 60 ? "text-amber-500" : "text-muted-foreground"}`}>{Math.round(score)}</span>
    </div>
  );
}

function ProspectCard({ prospect, products }: { prospect: Prospect; products: Product[] }) {
  const [expanded, setExpanded] = useState(false);
  const matchedProducts = JSON.parse(prospect.matchedProducts || "[]") as string[];
  const signals = JSON.parse(prospect.signals || "[]") as string[];

  return (
    <Card className={`border-border/50 transition-all ${prospect.score >= 80 ? "border-l-2 border-l-rose-500" : prospect.score >= 60 ? "border-l-2 border-l-amber-500" : ""}`}>
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              {prospect.score >= 80 && <Flame className="w-4 h-4 text-rose-500 shrink-0" />}
              <h3 className="font-semibold text-sm truncate">{prospect.companyName}</h3>
            </div>
            <div className="flex flex-wrap gap-1.5 mb-2">
              <Badge variant="outline" className="text-[10px]">{prospect.industry}</Badge>
              <Badge variant="outline" className="text-[10px]">{prospect.companySize}</Badge>
              <Badge className={`text-[10px] ${urgencyColors[prospect.urgency]}`}>{prospect.urgency}</Badge>
              <Badge className={`text-[10px] ${statusColors[prospect.status]}`}>{prospect.status}</Badge>
            </div>
            <ScoreBar score={prospect.score} />
          </div>
          <Button variant="ghost" size="sm" onClick={() => setExpanded(!expanded)} className="shrink-0">
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </Button>
        </div>
        {expanded && (
          <div className="mt-3 pt-3 border-t border-border/50 space-y-3">
            <div><p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1">Why They Need Us</p><p className="text-sm leading-relaxed">{prospect.reason}</p></div>
            {signals.length > 0 && <div><p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1">Market Signals</p>{signals.map((s, i) => <div key={i} className="flex items-start gap-2"><Signal className="w-3 h-3 text-primary mt-0.5 shrink-0" /><p className="text-xs text-muted-foreground">{s}</p></div>)}</div>}
            {matchedProducts.length > 0 && <div><p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1">Recommended Products</p><div className="flex flex-wrap gap-1.5">{matchedProducts.map(slug => <Badge key={slug} variant="secondary" className="text-[10px]">{products.find(p => p.slug === slug)?.name || slug}</Badge>)}</div></div>}
            <div className="flex items-center gap-2">
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Status:</p>
              <div className="flex gap-1">{["new","contacted","engaged","qualified","closed"].map(s => <button key={s} onClick={() => store.updateProspectStatus(prospect.id, s)} className={`text-[10px] px-2 py-0.5 rounded-md border transition-colors ${prospect.status === s ? "bg-primary/15 text-primary border-primary/30" : "border-border/50 text-muted-foreground hover:text-foreground"}`}>{s}</button>)}</div>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

export default function ProspectEngine() {
  const { toast } = useToast();
  const [scanIndustry, setScanIndustry] = useState("All Industries");
  const [productFocus, setProductFocus] = useState("");
  const prospects = useProspects();

  const { data: products = [] } = useQuery<Product[]>({ queryKey: ["/api/products"] });

  const scanProspects = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/prospects/scan", { industry: scanIndustry === "All Industries" ? undefined : scanIndustry, productFocus: productFocus || undefined });
      return res.json();
    },
    onSuccess: (data: Prospect[]) => {
      store.addProspects(data);
      toast({ title: "Scan complete", description: `Found ${Array.isArray(data) ? data.length : 0} prospects.` });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const hot = prospects.filter(p => p.score >= 75);
  const warm = prospects.filter(p => p.score >= 50 && p.score < 75);
  const cold = prospects.filter(p => p.score < 50);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-rose-500/10 flex items-center justify-center"><Radar className="w-5 h-5 text-rose-500" /></div>
        <div><h1 className="text-xl font-bold">Prospect Engine</h1><p className="text-sm text-muted-foreground">AI-powered prospect discovery and scoring</p></div>
      </div>

      <Card className="border-border/50">
        <div className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <Select value={scanIndustry} onValueChange={setScanIndustry}>
                <SelectTrigger><SelectValue placeholder="Select industry" /></SelectTrigger>
                <SelectContent>{scanIndustries.map(i => <SelectItem key={i} value={i}>{i}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="flex-1">
              <Select value={productFocus} onValueChange={setProductFocus}>
                <SelectTrigger><SelectValue placeholder="Product focus (optional)" /></SelectTrigger>
                <SelectContent><SelectItem value="all">All Products</SelectItem>{products.map(p => <SelectItem key={p.slug} value={p.slug}>{p.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <Button onClick={() => scanProspects.mutate()} disabled={scanProspects.isPending} className="sm:w-auto w-full">
              {scanProspects.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Scanning...</> : <><Radar className="w-4 h-4 mr-2" />Scan for Prospects</>}
            </Button>
          </div>
          {scanProspects.isPending && <div className="mt-3 p-3 rounded-lg bg-primary/5 border border-primary/20"><div className="flex items-center gap-2 text-sm text-primary"><Radar className="w-4 h-4 animate-pulse" /><span className="font-medium">AI scanning market data and company profiles...</span></div></div>}
        </div>
      </Card>

      {prospects.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <Card className="border-border/50 border-l-2 border-l-rose-500"><div className="p-3 text-center"><p className="text-2xl font-bold text-rose-500">{hot.length}</p><p className="text-[10px] text-muted-foreground uppercase tracking-wider">Hot (75+)</p></div></Card>
          <Card className="border-border/50 border-l-2 border-l-amber-500"><div className="p-3 text-center"><p className="text-2xl font-bold text-amber-500">{warm.length}</p><p className="text-[10px] text-muted-foreground uppercase tracking-wider">Warm (50-74)</p></div></Card>
          <Card className="border-border/50 border-l-2 border-l-blue-500"><div className="p-3 text-center"><p className="text-2xl font-bold text-blue-500">{cold.length}</p><p className="text-[10px] text-muted-foreground uppercase tracking-wider">Cold (&lt;50)</p></div></Card>
        </div>
      )}

      {prospects.length > 0 ? (
        <div className="space-y-2">{prospects.map(p => <ProspectCard key={p.id} prospect={p} products={products} />)}</div>
      ) : (
        <Card className="border-border/50"><div className="flex flex-col items-center justify-center py-16 text-muted-foreground"><Radar className="w-8 h-8 mb-3 opacity-40" /><p className="text-sm">No prospects yet — run a scan to discover high-value targets</p></div></Card>
      )}
    </div>
  );
}
