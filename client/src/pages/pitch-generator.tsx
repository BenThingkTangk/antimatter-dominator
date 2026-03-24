import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { TrendingUp, Loader2, Copy, Sparkles, History, Mail, Phone, Presentation, FileText } from "lucide-react";
import type { Product } from "@shared/schema";

interface Pitch {
  id: number;
  productId: number;
  pitchType: string;
  targetPersona: string;
  content: string;
  createdAt: string;
}

const pitchTypes = [
  { value: "elevator", label: "Elevator Pitch", icon: Sparkles, description: "30-second killer pitch" },
  { value: "email", label: "Cold Email", icon: Mail, description: "Outreach email that opens doors" },
  { value: "cold-call", label: "Cold Call Script", icon: Phone, description: "Phone opener that hooks" },
  { value: "demo-intro", label: "Demo Introduction", icon: Presentation, description: "Demo hook and setup" },
  { value: "executive-brief", label: "Executive Brief", icon: FileText, description: "C-suite talking points" },
];

const personas = [
  "CTO / VP Engineering",
  "CISO / Security Director",
  "CEO / Founder",
  "VP Sales / Revenue",
  "CFO / Finance Director",
  "Head of Product",
  "Director of Operations",
  "Real Estate Broker / Team Lead",
  "Healthcare Administrator",
  "Chief Medical Officer",
  "RCM / Billing Manager",
  "Head of Digital Transformation",
];

export default function PitchGenerator() {
  const { toast } = useToast();

  const params = new URLSearchParams(window.location.hash.split("?")[1] || "");
  const initialProduct = params.get("product") || "";

  const [selectedProduct, setSelectedProduct] = useState(initialProduct);
  const [pitchType, setPitchType] = useState("elevator");
  const [persona, setPersona] = useState("");
  const [customContext, setCustomContext] = useState("");
  const [pitchHistory, setPitchHistory] = useState<Pitch[]>([]);

  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });

  const generatePitch = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/pitch/generate", {
        productSlug: selectedProduct,
        pitchType,
        targetPersona: persona,
        customContext: customContext || undefined,
      });
      return res.json();
    },
    onSuccess: (data: Pitch) => {
      setPitchHistory((prev) => [data, ...prev]);
      toast({ title: "Pitch generated", description: "Your lethal pitch is ready." });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied", description: "Pitch copied to clipboard" });
  };

  const selectedProductData = products.find((p) => p.slug === selectedProduct);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <TrendingUp className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold">Pitch Generator</h1>
          <p className="text-sm text-muted-foreground">AI-powered pitch creation for the Antimatter ecosystem</p>
        </div>
      </div>

      <Tabs defaultValue="generate" className="space-y-4">
        <TabsList>
          <TabsTrigger value="generate" data-testid="tab-generate">
            <Sparkles className="w-3.5 h-3.5 mr-1.5" />
            Generate
          </TabsTrigger>
          <TabsTrigger value="history" data-testid="tab-history">
            <History className="w-3.5 h-3.5 mr-1.5" />
            History ({pitchHistory.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="generate" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="border-border/50 lg:col-span-1">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Configuration</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block uppercase tracking-wider">Product</label>
                  <Select value={selectedProduct} onValueChange={setSelectedProduct}>
                    <SelectTrigger data-testid="select-product">
                      <SelectValue placeholder="Select a product" />
                    </SelectTrigger>
                    <SelectContent>
                      {products.map((p) => (
                        <SelectItem key={p.slug} value={p.slug}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block uppercase tracking-wider">Pitch Type</label>
                  <div className="grid grid-cols-1 gap-1.5">
                    {pitchTypes.map((pt) => {
                      const Icon = pt.icon;
                      return (
                        <button
                          key={pt.value}
                          onClick={() => setPitchType(pt.value)}
                          className={`flex items-center gap-2.5 p-2.5 rounded-lg border text-left transition-all text-sm ${
                            pitchType === pt.value ? "border-primary/50 bg-primary/5 text-foreground" : "border-border/50 text-muted-foreground hover:border-border hover:text-foreground"
                          }`}
                          data-testid={`button-pitch-type-${pt.value}`}
                        >
                          <Icon className="w-3.5 h-3.5 shrink-0" />
                          <div>
                            <p className="text-xs font-medium">{pt.label}</p>
                            <p className="text-[10px] text-muted-foreground">{pt.description}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block uppercase tracking-wider">Target Persona</label>
                  <Select value={persona} onValueChange={setPersona}>
                    <SelectTrigger data-testid="select-persona">
                      <SelectValue placeholder="Who are you pitching?" />
                    </SelectTrigger>
                    <SelectContent>
                      {personas.map((p) => (
                        <SelectItem key={p} value={p}>
                          {p}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block uppercase tracking-wider">Extra Context (optional)</label>
                  <Textarea
                    placeholder="E.g., They just had a data breach, their competitor launched AI..."
                    value={customContext}
                    onChange={(e) => setCustomContext(e.target.value)}
                    className="min-h-[80px] text-sm"
                    data-testid="input-context"
                  />
                </div>

                <Button className="w-full" onClick={() => generatePitch.mutate()} disabled={!selectedProduct || !persona || generatePitch.isPending} data-testid="button-generate-pitch">
                  {generatePitch.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 mr-2" />
                      Generate Pitch
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>

            <Card className="border-border/50 lg:col-span-2">
              <CardHeader className="pb-3 flex flex-row items-center justify-between">
                <CardTitle className="text-sm">Generated Pitch</CardTitle>
                {pitchHistory.length > 0 && (
                  <Button variant="ghost" size="sm" onClick={() => copyToClipboard(pitchHistory[0]?.content || "")} data-testid="button-copy-pitch">
                    <Copy className="w-3.5 h-3.5 mr-1.5" />
                    Copy
                  </Button>
                )}
              </CardHeader>
              <CardContent>
                {generatePitch.isPending ? (
                  <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                    <Loader2 className="w-8 h-8 animate-spin text-primary mb-3" />
                    <p className="text-sm font-medium">AI is crafting your pitch...</p>
                    <p className="text-xs mt-1">Analyzing product data and market positioning</p>
                  </div>
                ) : pitchHistory.length > 0 ? (
                  <div className="space-y-3">
                    <div className="flex gap-2 flex-wrap">
                      {selectedProductData && <Badge variant="secondary">{selectedProductData.name}</Badge>}
                      <Badge variant="outline">{pitchTypes.find((p) => p.value === pitchHistory[0]?.pitchType)?.label}</Badge>
                      <Badge variant="outline">{pitchHistory[0]?.targetPersona}</Badge>
                    </div>
                    <div className="prose prose-sm dark:prose-invert max-w-none">
                      <div className="whitespace-pre-wrap text-sm leading-relaxed">{pitchHistory[0]?.content}</div>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                    <TrendingUp className="w-8 h-8 mb-3 opacity-40" />
                    <p className="text-sm">Select a product, pitch type, and persona</p>
                    <p className="text-xs mt-1">Then hit generate to create your pitch</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="history" className="space-y-3">
          {pitchHistory.length === 0 ? (
            <Card className="border-border/50">
              <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <History className="w-8 h-8 mb-3 opacity-40" />
                <p className="text-sm">No pitches generated yet</p>
              </CardContent>
            </Card>
          ) : (
            pitchHistory.map((pitch) => {
              const product = products.find((p) => p.id === pitch.productId);
              return (
                <Card key={pitch.id} className="border-border/50" data-testid={`card-pitch-${pitch.id}`}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex gap-2 flex-wrap">
                        <Badge variant="secondary">{product?.name || "Unknown"}</Badge>
                        <Badge variant="outline">{pitchTypes.find((p) => p.value === pitch.pitchType)?.label}</Badge>
                        <Badge variant="outline">{pitch.targetPersona}</Badge>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => copyToClipboard(pitch.content)}>
                        <Copy className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                    <p className="text-sm whitespace-pre-wrap leading-relaxed line-clamp-6">{pitch.content}</p>
                    <p className="text-[10px] text-muted-foreground mt-2">{new Date(pitch.createdAt).toLocaleString()}</p>
                  </CardContent>
                </Card>
              );
            })
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
