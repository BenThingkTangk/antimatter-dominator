import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { store, useObjections, type ObjectionEntry } from "@/lib/store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { MessageSquareWarning, Loader2, Copy, Zap, History, ShieldCheck, DollarSign, Clock, Users, AlertTriangle, Lock, Plus, ChevronDown, ChevronUp } from "lucide-react";
import type { Product } from "@shared/schema";

const categoryIcons: Record<string, any> = { price: DollarSign, competition: ShieldCheck, timing: Clock, authority: Users, need: AlertTriangle, trust: Lock };
const categoryColors: Record<string, string> = { price: "bg-amber-500/15 text-amber-500", competition: "bg-blue-500/15 text-blue-500", timing: "bg-purple-500/15 text-purple-500", authority: "bg-emerald-500/15 text-emerald-500", need: "bg-rose-500/15 text-rose-500", trust: "bg-cyan-500/15 text-cyan-500" };

const quickObjections = ["We already have something in place","It's too expensive","We're not ready for AI yet","I need to check with my boss","We've been burned by vendors before","Quantum threats aren't real yet","Our team won't adopt new tools","Can you prove ROI?"];

const STORAGE_KEY = "atom_objection_history";

interface LocalObjectionEntry {
  id: string;
  selectedProduct: string;
  objectionText: string;
  context: string;
  selectedCategory: string;
  response: string;
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

function loadHistory(): LocalObjectionEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveHistory(entries: LocalObjectionEntry[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {}
}

export default function ObjectionHandler() {
  const { toast } = useToast();
  const params = new URLSearchParams(window.location.hash.split("?")[1] || "");
  const [selectedProduct, setSelectedProduct] = useState(params.get("product") || "");
  const [objectionText, setObjectionText] = useState("");
  const [context, setContext] = useState("");
  const objectionHistory = useObjections();

  const [showHistory, setShowHistory] = useState(false);
  const [localHistory, setLocalHistory] = useState<LocalObjectionEntry[]>([]);
  const [activeResponse, setActiveResponse] = useState<LocalObjectionEntry | null>(null);
  const [expandedEntry, setExpandedEntry] = useState<string | null>(null);

  useEffect(() => {
    setLocalHistory(loadHistory());
  }, []);

  const { data: products = [] } = useQuery<Product[]>({ queryKey: ["/api/products"] });

  const handleObjection = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/objection/handle", { productSlug: selectedProduct, objection: objectionText, context: context || undefined });
      return res.json();
    },
    onSuccess: (data: ObjectionEntry) => {
      store.addObjection(data);

      const productName = products.find(p => p.slug === selectedProduct)?.name || selectedProduct;
      const entry: LocalObjectionEntry = {
        id: `${Date.now()}-${Math.random()}`,
        selectedProduct: productName,
        objectionText,
        context,
        selectedCategory: data.category || "general",
        response: data.response,
        timestamp: Date.now(),
      };
      const updated = [entry, ...loadHistory()].slice(0, 50);
      saveHistory(updated);
      setLocalHistory(updated);
      setActiveResponse(entry);

      toast({ title: "Response ready", description: "Counter-objection crafted." });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const copyToClipboard = (text: string) => { navigator.clipboard.writeText(text); toast({ title: "Copied" }); };

  const restoreEntry = (entry: LocalObjectionEntry) => {
    const productObj = products.find(p => p.name === entry.selectedProduct);
    if (productObj) setSelectedProduct(productObj.slug);
    setObjectionText(entry.objectionText);
    setContext(entry.context);
    setActiveResponse(entry);
    setShowHistory(false);
    setExpandedEntry(null);
  };

  const clearHistory = () => {
    saveHistory([]);
    setLocalHistory([]);
    toast({ title: "History cleared" });
  };

  // Only show result from current session (not old store data)
  const currentResponse = activeResponse;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center"><MessageSquareWarning className="w-5 h-5 text-amber-500" /></div>
        <div className="flex-1">
          <h1 className="text-xl font-bold">Objection Handler</h1>
          <p className="text-sm text-muted-foreground">Counter any pushback with AI-powered responses</p>
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
                <p className="text-sm">No objections handled yet</p>
              </CardContent>
            </Card>
          ) : (
            <>
              {localHistory.map((entry) => {
                const CatIcon = categoryIcons[entry.selectedCategory] || AlertTriangle;
                return (
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
                            {entry.selectedCategory} objection for {entry.selectedProduct}
                          </p>
                          <p className="text-xs text-foreground/40 mt-0.5">{formatTimestamp(entry.timestamp)}</p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <Badge className={`${categoryColors[entry.selectedCategory] || "bg-muted"} text-[10px]`}>
                            <CatIcon className="w-3 h-3 mr-1" />{entry.selectedCategory}
                          </Badge>
                          {expandedEntry === entry.id ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                        </div>
                      </div>
                      {expandedEntry !== entry.id && (
                        <p className="text-xs text-muted-foreground mt-2 line-clamp-2 italic">"{entry.objectionText}"</p>
                      )}
                    </button>

                    {expandedEntry === entry.id && (
                      <div className="px-4 pb-4 space-y-3 border-t border-border/30 pt-3">
                        <div className="flex gap-2 flex-wrap">
                          <Badge variant="secondary">{entry.selectedProduct}</Badge>
                          <Badge className={categoryColors[entry.selectedCategory] || "bg-muted"}>
                            <CatIcon className="w-3 h-3 mr-1" />{entry.selectedCategory}
                          </Badge>
                        </div>
                        <div className="p-3 rounded-lg bg-muted/30 border border-border/50">
                          <p className="text-xs font-medium text-muted-foreground mb-1">OBJECTION:</p>
                          <p className="text-sm italic">"{entry.objectionText}"</p>
                        </div>
                        <div className="whitespace-pre-wrap text-sm leading-relaxed">{entry.response}</div>
                        <div className="flex gap-2 pt-1">
                          <Button size="sm" variant="outline" className="text-xs h-7 gap-1" onClick={() => restoreEntry(entry)}>
                            <Plus className="w-3 h-3" />Restore & Edit
                          </Button>
                          <Button size="sm" variant="ghost" className="text-xs h-7 gap-1" onClick={() => copyToClipboard(entry.response)}>
                            <Copy className="w-3 h-3" />Copy
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
              <div className="flex justify-end pt-1">
                <button onClick={clearHistory} className="text-xs text-red-400 hover:text-red-300 transition-colors">Clear History</button>
              </div>
            </>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card className="border-border/50 lg:col-span-1">
            <CardHeader className="pb-3"><CardTitle className="text-sm">Objection Details</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block uppercase tracking-wider">Product</label>
                <Select value={selectedProduct} onValueChange={setSelectedProduct}>
                  <SelectTrigger><SelectValue placeholder="Select a product" /></SelectTrigger>
                  <SelectContent>{products.map((p) => <SelectItem key={p.slug} value={p.slug}>{p.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block uppercase tracking-wider">The Objection</label>
                <Textarea placeholder="Type the objection..." value={objectionText} onChange={(e) => setObjectionText(e.target.value)} className="min-h-[100px] text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block uppercase tracking-wider">Quick Select</label>
                <div className="flex flex-wrap gap-1.5">
                  {quickObjections.map((obj) => <button key={obj} onClick={() => setObjectionText(obj)} className="text-[10px] px-2 py-1 rounded-md border border-border/50 text-muted-foreground hover:text-foreground hover:border-border transition-colors">{obj}</button>)}
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block uppercase tracking-wider">Context (optional)</label>
                <Textarea placeholder="E.g., 200-bed hospital using Epic..." value={context} onChange={(e) => setContext(e.target.value)} className="min-h-[60px] text-sm" />
              </div>
              <Button className="w-full" onClick={() => handleObjection.mutate()} disabled={!selectedProduct || !objectionText || handleObjection.isPending}>
                {handleObjection.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Crafting response...</> : <><Zap className="w-4 h-4 mr-2" />Destroy This Objection</>}
              </Button>
            </CardContent>
          </Card>

          <Card className="border-border/50 lg:col-span-2">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-sm">AI Response</CardTitle>
              {currentResponse && <Button variant="ghost" size="sm" onClick={() => copyToClipboard(currentResponse.response)}><Copy className="w-3.5 h-3.5 mr-1.5" />Copy</Button>}
            </CardHeader>
            <CardContent>
              {handleObjection.isPending ? (
                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground"><Loader2 className="w-8 h-8 animate-spin text-primary mb-3" /><p className="text-sm font-medium">Crafting your counter-response...</p></div>
              ) : currentResponse ? (
                <div className="space-y-3">
                  <div className="flex gap-2 flex-wrap items-center">
                    <Badge variant="secondary">{currentResponse.selectedProduct}</Badge>
                    <Badge className={categoryColors[currentResponse.selectedCategory] || "bg-muted"}>{currentResponse.selectedCategory}</Badge>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/30 border border-border/50">
                    <p className="text-xs font-medium text-muted-foreground mb-1">OBJECTION:</p>
                    <p className="text-sm italic">"{currentResponse.objectionText}"</p>
                  </div>
                  <div className="whitespace-pre-wrap text-sm leading-relaxed">{currentResponse.response}</div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground"><MessageSquareWarning className="w-8 h-8 mb-3 opacity-40" /><p className="text-sm">Enter an objection to get your counter-response</p></div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
