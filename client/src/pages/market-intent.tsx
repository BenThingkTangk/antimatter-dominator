import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { store, useIntel, type MarketIntel } from "@/lib/store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Shield, Loader2, Copy, Brain, Zap } from "lucide-react";
import type { Product } from "@shared/schema";

const industries = ["Healthcare","Financial Services","Real Estate","Cybersecurity / Defense","Technology / SaaS","Government / Public Sector","Manufacturing","Retail / E-Commerce","Insurance","Education"];
const topics = ["AI Adoption & Digital Transformation","Regulatory Compliance Pressure","Cybersecurity & Quantum Threats","Revenue Cycle & Billing Optimization","Cost Reduction Mandates","Post-Quantum Cryptography","HIPAA / SOC2 / FedRAMP Compliance","Real Estate Market Dynamics"];

export default function MarketIntent() {
  const { toast } = useToast();
  const [selectedProduct, setSelectedProduct] = useState("");
  const [selectedIndustry, setSelectedIndustry] = useState("");
  const [selectedTopic, setSelectedTopic] = useState("");
  const intelHistory = useIntel();

  const { data: products = [] } = useQuery<Product[]>({ queryKey: ["/api/products"] });

  const analyzeIntent = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/market-intent/analyze", { productSlug: selectedProduct || undefined, industry: selectedIndustry || undefined, topic: selectedTopic || undefined });
      return res.json();
    },
    onSuccess: (data: MarketIntel) => {
      store.addIntel(data);
      toast({ title: "Intel ready", description: "Market intelligence complete." });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const copyToClipboard = (text: string) => { navigator.clipboard.writeText(text); toast({ title: "Copied" }); };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center"><Shield className="w-5 h-5 text-emerald-500" /></div>
        <div><h1 className="text-xl font-bold">Market Intent</h1><p className="text-sm text-muted-foreground">AI-powered market intelligence and selling perspectives</p></div>
      </div>

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
          ) : intelHistory.length > 0 ? intelHistory.map((intel) => (
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
    </div>
  );
}
