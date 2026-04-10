import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { store, usePitches, type Pitch } from "@/lib/store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { TrendingUp, Loader2, Copy, Sparkles, History, Mail, Phone, Presentation, FileText, Plus, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import type { Product } from "@shared/schema";

const pitchTypes = [
  { value: "elevator", label: "Elevator Pitch", icon: Sparkles, description: "30-second killer pitch" },
  { value: "email", label: "Cold Email", icon: Mail, description: "Outreach email that opens doors" },
  { value: "cold-call", label: "Cold Call Script", icon: Phone, description: "Phone opener that hooks" },
  { value: "demo-intro", label: "Demo Introduction", icon: Presentation, description: "Demo hook and setup" },
  { value: "executive-brief", label: "Executive Brief", icon: FileText, description: "C-suite talking points" },
];

const personas = [
  "CTO / VP Engineering", "CISO / Security Director", "CEO / Founder", "VP Sales / Revenue",
  "CFO / Finance Director", "Head of Product", "Director of Operations", "Real Estate Broker / Team Lead",
  "Healthcare Administrator", "Chief Medical Officer", "RCM / Billing Manager", "Head of Digital Transformation",
];

const STORAGE_KEY = "atom_pitch_history";

interface LocalPitchEntry {
  id: string;
  product: string;
  pitchType: string;
  persona: string;
  industry: string;
  generatedPitch: string;
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

function loadHistory(): LocalPitchEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveHistory(entries: LocalPitchEntry[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {}
}

export default function PitchGenerator() {
  const { toast } = useToast();
  const params = new URLSearchParams(window.location.hash.split("?")[1] || "");
  const [selectedProduct, setSelectedProduct] = useState(params.get("product") || "");
  const [pitchType, setPitchType] = useState("elevator");
  const [persona, setPersona] = useState("");
  const [customContext, setCustomContext] = useState("");
  const pitchHistory = usePitches();

  const [showHistory, setShowHistory] = useState(false);
  const [localHistory, setLocalHistory] = useState<LocalPitchEntry[]>([]);
  const [activePitch, setActivePitch] = useState<string | null>(null);
  const [expandedEntry, setExpandedEntry] = useState<string | null>(null);

  useEffect(() => {
    setLocalHistory(loadHistory());
  }, []);

  const { data: products = [] } = useQuery<Product[]>({ queryKey: ["/api/products"] });

  const generatePitch = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/pitch/generate", {
        productSlug: selectedProduct, pitchType, targetPersona: persona, customContext: customContext || undefined,
      });
      return res.json();
    },
    onSuccess: (data: Pitch) => {
      store.addPitch(data);

      // Save to localStorage history
      const productName = products.find(p => p.slug === selectedProduct)?.name || selectedProduct;
      const entry: LocalPitchEntry = {
        id: `${Date.now()}-${Math.random()}`,
        product: productName,
        pitchType,
        persona,
        industry: "",
        generatedPitch: data.content,
        timestamp: Date.now(),
      };
      const updated = [entry, ...loadHistory()].slice(0, 50);
      saveHistory(updated);
      setLocalHistory(updated);
      setActivePitch(data.content);

      toast({ title: "Pitch generated", description: "Your lethal pitch is ready." });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied", description: "Pitch copied to clipboard" });
  };

  const restoreEntry = (entry: LocalPitchEntry) => {
    // Find product slug from name
    const productObj = products.find(p => p.name === entry.product);
    if (productObj) setSelectedProduct(productObj.slug);
    setPitchType(entry.pitchType);
    setPersona(entry.persona);
    setActivePitch(entry.generatedPitch);
    setShowHistory(false);
    setExpandedEntry(null);
  };

  const clearHistory = () => {
    saveHistory([]);
    setLocalHistory([]);
    toast({ title: "History cleared" });
  };

  const pitchTypeLabel = pitchTypes.find(p => p.value === pitchType)?.label || pitchType;

  // Only show result from current session (not old store data)
  const displayPitch = activePitch;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center"><TrendingUp className="w-5 h-5 text-primary" /></div>
        <div className="flex-1">
          <h1 className="text-xl font-bold">Pitch Generator</h1>
          <p className="text-sm text-muted-foreground">AI-powered pitch creation for the Antimatter ecosystem</p>
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
                <p className="text-sm">No pitch history yet</p>
              </CardContent>
            </Card>
          ) : (
            <>
              {localHistory.map((entry) => (
                <div
                  key={entry.id}
                  className="rounded-xl border border-[rgba(246,246,253,0.08)] bg-[rgba(246,246,253,0.03)] border-l-2 border-l-[#696aac] overflow-hidden"
                  style={{ borderLeftColor: "#696aac" }}
                >
                  <button
                    className="w-full text-left p-4"
                    onClick={() => setExpandedEntry(expandedEntry === entry.id ? null : entry.id)}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {pitchTypes.find(p => p.value === entry.pitchType)?.label || entry.pitchType} pitch for {entry.product}
                        </p>
                        <p className="text-xs text-foreground/40 mt-0.5">{formatTimestamp(entry.timestamp)}</p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Badge variant="outline" className="text-[10px]">{entry.persona}</Badge>
                        {expandedEntry === entry.id ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                      </div>
                    </div>
                    {expandedEntry !== entry.id && (
                      <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{entry.generatedPitch}</p>
                    )}
                  </button>

                  {expandedEntry === entry.id && (
                    <div className="px-4 pb-4 space-y-3 border-t border-border/30 pt-3">
                      <div className="flex gap-2 flex-wrap">
                        <Badge variant="secondary">{entry.product}</Badge>
                        <Badge variant="outline">{pitchTypes.find(p => p.value === entry.pitchType)?.label || entry.pitchType}</Badge>
                        <Badge variant="outline">{entry.persona}</Badge>
                      </div>
                      <div className="whitespace-pre-wrap text-sm leading-relaxed">{entry.generatedPitch}</div>
                      <div className="flex gap-2 pt-1">
                        <Button size="sm" variant="outline" className="text-xs h-7 gap-1" onClick={() => restoreEntry(entry)}>
                          <Plus className="w-3 h-3" />Restore & Edit
                        </Button>
                        <Button size="sm" variant="ghost" className="text-xs h-7 gap-1" onClick={() => copyToClipboard(entry.generatedPitch)}>
                          <Copy className="w-3 h-3" />Copy
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
            <CardHeader className="pb-3"><CardTitle className="text-sm">Configuration</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block uppercase tracking-wider">Product</label>
                <Select value={selectedProduct} onValueChange={setSelectedProduct}>
                  <SelectTrigger><SelectValue placeholder="Select a product" /></SelectTrigger>
                  <SelectContent>{products.map((p) => (<SelectItem key={p.slug} value={p.slug}>{p.name}</SelectItem>))}</SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block uppercase tracking-wider">Pitch Type</label>
                <div className="grid grid-cols-1 gap-1.5">
                  {pitchTypes.map((pt) => {
                    const Icon = pt.icon;
                    return (
                      <button key={pt.value} onClick={() => setPitchType(pt.value)}
                        className={`flex items-center gap-2.5 p-2.5 rounded-lg border text-left transition-all text-sm ${pitchType === pt.value ? "border-primary/50 bg-primary/5 text-foreground" : "border-border/50 text-muted-foreground hover:border-border hover:text-foreground"}`}>
                        <Icon className="w-3.5 h-3.5 shrink-0" />
                        <div><p className="text-xs font-medium">{pt.label}</p><p className="text-[10px] text-muted-foreground">{pt.description}</p></div>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block uppercase tracking-wider">Target Persona</label>
                <Select value={persona} onValueChange={setPersona}>
                  <SelectTrigger><SelectValue placeholder="Who are you pitching?" /></SelectTrigger>
                  <SelectContent>{personas.map((p) => (<SelectItem key={p} value={p}>{p}</SelectItem>))}</SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block uppercase tracking-wider">Extra Context (optional)</label>
                <Textarea placeholder="E.g., They just had a data breach..." value={customContext} onChange={(e) => setCustomContext(e.target.value)} className="min-h-[80px] text-sm" />
              </div>
              <Button className="w-full" onClick={() => generatePitch.mutate()} disabled={!selectedProduct || !persona || generatePitch.isPending}>
                {generatePitch.isPending ? (<><Loader2 className="w-4 h-4 mr-2 animate-spin" />Generating...</>) : (<><Sparkles className="w-4 h-4 mr-2" />Generate Pitch</>)}
              </Button>
            </CardContent>
          </Card>

          <Card className="border-border/50 lg:col-span-2">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-sm">Generated Pitch</CardTitle>
              {displayPitch && <Button variant="ghost" size="sm" onClick={() => copyToClipboard(displayPitch)}><Copy className="w-3.5 h-3.5 mr-1.5" />Copy</Button>}
            </CardHeader>
            <CardContent>
              {generatePitch.isPending ? (
                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground"><Loader2 className="w-8 h-8 animate-spin text-primary mb-3" /><p className="text-sm font-medium">AI is crafting your pitch...</p></div>
              ) : displayPitch ? (
                <div className="space-y-3">
                  <div className="flex gap-2 flex-wrap">
                    <Badge variant="secondary">{products.find(p => p.slug === selectedProduct)?.name || selectedProduct}</Badge>
                    <Badge variant="outline">{pitchTypes.find((p) => p.value === pitchType)?.label}</Badge>
                    <Badge variant="outline">{persona}</Badge>
                  </div>
                  <div className="whitespace-pre-wrap text-sm leading-relaxed">{displayPitch}</div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground"><TrendingUp className="w-8 h-8 mb-3 opacity-40" /><p className="text-sm">Select a product, pitch type, and persona</p></div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
