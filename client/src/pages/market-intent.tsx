import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { store, useIntel, type MarketIntel } from "@/lib/store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Shield, Loader2, Copy, Brain, Zap, History, Plus, ChevronDown, ChevronUp } from "lucide-react";
import type { Product } from "@shared/schema";

const industries = ["Healthcare","Financial Services","Real Estate","Cybersecurity / Defense","Technology / SaaS","Government / Public Sector","Manufacturing","Retail / E-Commerce","Insurance","Education"];
const topics = ["AI Adoption & Digital Transformation","Regulatory Compliance Pressure","Cybersecurity & Quantum Threats","Revenue Cycle & Billing Optimization","Cost Reduction Mandates","Post-Quantum Cryptography","HIPAA / SOC2 / FedRAMP Compliance","Real Estate Market Dynamics"];

const STORAGE_KEY = "atom_market_history";

interface LocalMarketEntry {
  id: string;
  selectedProduct: string;
  selectedIndustry: string;
  selectedTopic: string;
  analysisTitle: string;
  analysisSummary: string;
  impactLevel: string;
  timestamp: number;
}

function formatTimestamp(ts: number): string {
  const now = Date.now();
  const diff = now - ts;
  const hours = diff / (1000 * 60 * 60);
  if (hours < 1) {
    const mins = Math.floor(diff / (1000 * 60));
    return mins <= 1 ? "just now" : `${mins}m ago`;
  }
  if (hours < 24) return `${Math.floor(hours)}h ago`;
  const d = new Date(ts);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

function loadHistory(): LocalMarketEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveHistory(entries: LocalMarketEntry[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {}
}

export default function MarketIntent() {
  const { toast } = useToast();
  const [selectedProduct, setSelectedProduct] = useState("");
  const [selectedIndustry, setSelectedIndustry] = useState("");
  const [selectedTopic, setSelectedTopic] = useState("");
  const intelHistory = useIntel();
  const [hasSearched, setHasSearched] = useState(false);
  const [sessionResults, setSessionResults] = useState<typeof intelHistory>([]);

  const [showHistory, setShowHistory] = useState(false);
  const [localHistory, setLocalHistory] = useState<LocalMarketEntry[]>([]);
  const [expandedEntry, setExpandedEntry] = useState<string | null>(null);

  useEffect(() => {
    setLocalHistory(loadHistory());
  }, []);

  const { data: products = [] } = useQuery<Product[]>({ queryKey: ["/api/products"] });

  const analyzeIntent = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/market-intent/analyze", { productSlug: selectedProduct || undefined, industry: selectedIndustry || undefined, topic: selectedTopic || undefined });
      return res.json();
    },
    onSuccess: (data: MarketIntel) => {
      store.addIntel(data);
      setHasSearched(true);
      setSessionResults(prev => [data, ...prev]);

      const productName = selectedProduct === "all" ? "All Products" : (products.find(p => p.slug === selectedProduct)?.name || selectedProduct || "All Products");
      const entry: LocalMarketEntry = {
        id: `${Date.now()}-${Math.random()}`,
        selectedProduct: productName,
        selectedIndustry,
        selectedTopic,
        analysisTitle: data.title,
        analysisSummary: data.summary,
        impactLevel: data.impactLevel,
        timestamp: Date.now(),
      };
      const updated = [entry, ...loadHistory()].slice(0, 50);
      saveHistory(updated);
      setLocalHistory(updated);

      toast({ title: "Intel ready", description: "Market intelligence complete." });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const copyToClipboard = (text: string) => { navigator.clipboard.writeText(text); toast({ title: "Copied" }); };

  const restoreEntry = (entry: LocalMarketEntry) => {
    const productObj = products.find(p => p.name === entry.selectedProduct);
    if (productObj) setSelectedProduct(productObj.slug);
    else if (entry.selectedProduct === "All Products") setSelectedProduct("all");
    setSelectedIndustry(entry.selectedIndustry);
    setSelectedTopic(entry.selectedTopic);
    setShowHistory(false);
    setExpandedEntry(null);
  };

  const clearHistory = () => {
    saveHistory([]);
    setLocalHistory([]);
    toast({ title: "History cleared" });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center"><Shield className="w-5 h-5 text-emerald-500" /></div>
        <div className="flex-1">
          <h1 className="text-xl font-bold">Market Intent</h1>
          <p className="text-sm text-muted-foreground">AI-powered market intelligence and selling perspectives</p>
        </div>
        <div className="flex items-center gap-2">
          {showHistory && (
            <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={() => setShowHistory(false)}>
              <Plus className="w-3.5 h-3.5" />New Search
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            className={`h-8 text-xs gap-1.5 ${showHistory ? "bg-[#696aac]/10 border-[#696aac]" : ""}`}
            onClick={() => setShowHistory(!showHistory)}
          >
            <History className="w-3.5 h-3.5" />
            History
            {localHistory.length > 0 && (
              <span className="bg-[#696aac] text-white text-xs rounded-full px-1.5 py-0 leading-4">{localHistory.length}</span>
            )}
          </Button>
        </div>
      </div>

      {showHistory ? (
        <div className="space-y-3">
          {localHistory.length === 0 ? (
            <Card className="border-border/50">
              <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <History className="w-8 h-8 mb-3 opacity-40" />
                <p className="text-sm">No market intel history yet</p>
              </CardContent>
            </Card>
          ) : (
            <>
              {localHistory.map((entry) => (
                <div
                  key={entry.id}
                  className="rounded-xl border border-[rgba(246,246,253,0.08)] bg-[rgba(246,246,253,0.03)] overflow-hidden"
                  style={{ borderLeftWidth: "2px", borderLeftColor: "#696aac" }}
                >
                  <button
                    className="w-full text-left p-4"
                    onClick={() => setExpandedEntry(expandedEntry === entry.id ? null : entry.id)}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {entry.selectedTopic || "General"} — {entry.selectedIndustry || "All Industries"} / {entry.selectedProduct}
                        </p>
                        <p className="text-xs text-foreground/40 mt-0.5">{formatTimestamp(entry.timestamp)}</p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Badge variant="default" className="text-[10px]">{entry.impactLevel} impact</Badge>
                        {expandedEntry === entry.id ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                      </div>
                    </div>
                    {expandedEntry !== entry.id && (
                      <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{entry.analysisTitle}</p>
                    )}
                  </button>

                  {expandedEntry === entry.id && (
                    <div className="px-4 pb-4 space-y-3 border-t border-border/30 pt-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-sm">{entry.analysisTitle}</CardTitle>
                          <div className="flex gap-1.5 mt-1.5">
                            <Badge variant="default">{entry.impactLevel} impact</Badge>
                          </div>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => copyToClipboard(entry.analysisSummary)}>
                          <Copy className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                      <div className="whitespace-pre-wrap text-sm leading-relaxed">{entry.analysisSummary}</div>
                      <div className="flex gap-2 pt-1">
                        <Button size="sm" variant="outline" className="text-xs h-7 gap-1" onClick={() => restoreEntry(entry)}>
                          <Plus className="w-3 h-3" />Restore Inputs
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
              <div className="flex justify-end pt-1">
                <button onClick={clearHistory} className="text-xs text-red-400 hover:text-red-300 transition-colors">Clear History</button>
              </div>
            </>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card className="border-border/50 lg:col-span-1">
            <CardHeader className="pb-3"><CardTitle className="text-sm">Analysis Parameters</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block uppercase tracking-wider">Product Focus</label>
                <Select value={selectedProduct} onValueChange={setSelectedProduct}>
                  <SelectTrigger><SelectValue placeholder="All products" /></SelectTrigger>
                  <SelectContent><SelectItem value="all">All Products</SelectItem>{products.map((p) => <SelectItem key={p.slug} value={p.slug}>{p.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block uppercase tracking-wider">Industry</label>
                <Select value={selectedIndustry} onValueChange={setSelectedIndustry}>
                  <SelectTrigger><SelectValue placeholder="Select industry" /></SelectTrigger>
                  <SelectContent>{industries.map((i) => <SelectItem key={i} value={i}>{i}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block uppercase tracking-wider">Topic</label>
                <Select value={selectedTopic} onValueChange={setSelectedTopic}>
                  <SelectTrigger><SelectValue placeholder="Select topic" /></SelectTrigger>
                  <SelectContent>{topics.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <Button className="w-full" onClick={() => analyzeIntent.mutate()} disabled={analyzeIntent.isPending}>
                {analyzeIntent.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Analyzing...</> : <><Brain className="w-4 h-4 mr-2" />Generate Intel</>}
              </Button>
            </CardContent>
          </Card>

          <div className="lg:col-span-2 space-y-3">
            {analyzeIntent.isPending ? (
              <Card className="border-border/50"><CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground"><Loader2 className="w-8 h-8 animate-spin text-primary mb-3" /><p className="text-sm font-medium">Scanning market signals...</p></CardContent></Card>
            ) : sessionResults.length > 0 ? sessionResults.map((intel) => (
              <Card key={intel.id} className="border-border/50">
                <CardHeader className="pb-2 flex flex-row items-start justify-between">
                  <div><CardTitle className="text-sm">{intel.title}</CardTitle><div className="flex gap-1.5 mt-1.5"><Badge variant="default">{intel.impactLevel} impact</Badge></div></div>
                  <Button variant="ghost" size="sm" onClick={() => copyToClipboard(intel.summary)}><Copy className="w-3.5 h-3.5" /></Button>
                </CardHeader>
                <CardContent>
                  <div className="whitespace-pre-wrap text-sm leading-relaxed">{intel.summary}</div>
                  <p className="text-[10px] text-muted-foreground mt-3">{new Date(intel.createdAt).toLocaleString()}</p>
                </CardContent>
              </Card>
            )) : (
              <Card className="border-border/50"><CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground"><Shield className="w-8 h-8 mb-3 opacity-40" /><p className="text-sm">Select parameters and generate market intelligence</p></CardContent></Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
