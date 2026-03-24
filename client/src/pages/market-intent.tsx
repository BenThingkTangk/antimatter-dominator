import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Shield, Loader2, Copy, Brain, TrendingUp, Target, Zap } from "lucide-react";
import type { Product, MarketIntel } from "@shared/schema";

const industries = [
  "Healthcare",
  "Financial Services",
  "Real Estate",
  "Cybersecurity / Defense",
  "Technology / SaaS",
  "Government / Public Sector",
  "Manufacturing",
  "Retail / E-Commerce",
  "Insurance",
  "Education",
  "Energy / Utilities",
  "Legal",
];

const topics = [
  "AI Adoption & Digital Transformation",
  "Regulatory Compliance Pressure",
  "Cybersecurity & Quantum Threats",
  "Revenue Cycle & Billing Optimization",
  "Cost Reduction Mandates",
  "Competitive Displacement",
  "Post-Quantum Cryptography",
  "HIPAA / SOC2 / FedRAMP Compliance",
  "Real Estate Market Dynamics",
  "Workforce Automation & Efficiency",
];

export default function MarketIntent() {
  const { toast } = useToast();
  const [selectedProduct, setSelectedProduct] = useState("");
  const [selectedIndustry, setSelectedIndustry] = useState("");
  const [selectedTopic, setSelectedTopic] = useState("");

  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });

  const { data: intelHistory = [] } = useQuery<MarketIntel[]>({
    queryKey: ["/api/market-intel"],
  });

  const analyzeIntent = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/market-intent/analyze", {
        productSlug: selectedProduct || undefined,
        industry: selectedIndustry || undefined,
        topic: selectedTopic || undefined,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/market-intel"] });
      toast({ title: "Intel ready", description: "Market intelligence analysis complete." });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied", description: "Intel copied to clipboard" });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
          <Shield className="w-5 h-5 text-emerald-500" />
        </div>
        <div>
          <h1 className="text-xl font-bold">Market Intent</h1>
          <p className="text-sm text-muted-foreground">AI-powered market intelligence and selling perspectives</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Config */}
        <Card className="border-border/50 lg:col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Analysis Parameters</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Product Focus */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block uppercase tracking-wider">Product Focus (optional)</label>
              <Select value={selectedProduct} onValueChange={setSelectedProduct}>
                <SelectTrigger data-testid="select-market-product">
                  <SelectValue placeholder="All products" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Products</SelectItem>
                  {products.map(p => (
                    <SelectItem key={p.slug} value={p.slug}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Industry */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block uppercase tracking-wider">Target Industry</label>
              <Select value={selectedIndustry} onValueChange={setSelectedIndustry}>
                <SelectTrigger data-testid="select-industry">
                  <SelectValue placeholder="Select industry" />
                </SelectTrigger>
                <SelectContent>
                  {industries.map(i => (
                    <SelectItem key={i} value={i}>{i}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Topic */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block uppercase tracking-wider">Topic Focus</label>
              <Select value={selectedTopic} onValueChange={setSelectedTopic}>
                <SelectTrigger data-testid="select-topic">
                  <SelectValue placeholder="Select topic" />
                </SelectTrigger>
                <SelectContent>
                  {topics.map(t => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button
              className="w-full"
              onClick={() => analyzeIntent.mutate()}
              disabled={analyzeIntent.isPending}
              data-testid="button-analyze-intent"
            >
              {analyzeIntent.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Brain className="w-4 h-4 mr-2" />
                  Generate Intel
                </>
              )}
            </Button>

            {/* Quick Actions */}
            <div className="pt-2 border-t border-border/50">
              <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">Quick Intel</p>
              <div className="space-y-1.5">
                {products.slice(0, 3).map(p => (
                  <button
                    key={p.slug}
                    onClick={() => {
                      setSelectedProduct(p.slug);
                      setSelectedIndustry("");
                      setSelectedTopic("");
                      setTimeout(() => analyzeIntent.mutate(), 100);
                    }}
                    className="w-full flex items-center gap-2 p-2 rounded-lg border border-border/50 text-left hover:border-primary/30 transition-colors"
                    data-testid={`button-quick-intel-${p.slug}`}
                  >
                    <Zap className="w-3 h-3 text-primary shrink-0" />
                    <span className="text-xs truncate">{p.name} Market Brief</span>
                  </button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Intel Output */}
        <div className="lg:col-span-2 space-y-3">
          {analyzeIntent.isPending ? (
            <Card className="border-border/50">
              <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <Loader2 className="w-8 h-8 animate-spin text-primary mb-3" />
                <p className="text-sm font-medium">Scanning market signals...</p>
                <p className="text-xs mt-1">Analyzing trends, buyer signals, and competitive landscape</p>
              </CardContent>
            </Card>
          ) : intelHistory.length > 0 ? (
            intelHistory.map((intel) => (
              <Card key={intel.id} className="border-border/50" data-testid={`card-intel-${intel.id}`}>
                <CardHeader className="pb-2 flex flex-row items-start justify-between">
                  <div>
                    <CardTitle className="text-sm">{intel.title}</CardTitle>
                    <div className="flex gap-1.5 mt-1.5">
                      <Badge variant={intel.impactLevel === "high" ? "default" : "secondary"}>
                        {intel.impactLevel} impact
                      </Badge>
                      <Badge variant="outline">{intel.category}</Badge>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => copyToClipboard(intel.summary)}>
                    <Copy className="w-3.5 h-3.5" />
                  </Button>
                </CardHeader>
                <CardContent>
                  <div className="whitespace-pre-wrap text-sm leading-relaxed">{intel.summary}</div>
                  <p className="text-[10px] text-muted-foreground mt-3">
                    {new Date(intel.createdAt).toLocaleString()} · {intel.source}
                  </p>
                </CardContent>
              </Card>
            ))
          ) : (
            <Card className="border-border/50">
              <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <Shield className="w-8 h-8 mb-3 opacity-40" />
                <p className="text-sm">Select parameters and generate market intelligence</p>
                <p className="text-xs mt-1">Get trends, buyer signals, and competitive positioning</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
