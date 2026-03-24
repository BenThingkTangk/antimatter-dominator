import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { MessageSquareWarning, Loader2, Copy, Zap, History, ShieldCheck, DollarSign, Clock, Users, AlertTriangle, Lock } from "lucide-react";
import type { Product, Objection } from "@shared/schema";

const categoryIcons: Record<string, any> = {
  price: DollarSign,
  competition: ShieldCheck,
  timing: Clock,
  authority: Users,
  need: AlertTriangle,
  trust: Lock,
};

const categoryColors: Record<string, string> = {
  price: "bg-amber-500/15 text-amber-500",
  competition: "bg-blue-500/15 text-blue-500",
  timing: "bg-purple-500/15 text-purple-500",
  authority: "bg-emerald-500/15 text-emerald-500",
  need: "bg-rose-500/15 text-rose-500",
  trust: "bg-cyan-500/15 text-cyan-500",
};

const commonObjectionExamples = [
  "We already have something in place",
  "It's too expensive for our budget",
  "We're not ready for AI yet",
  "I need to check with my boss",
  "We've been burned by vendors before",
  "Quantum threats aren't real yet",
  "Our team won't adopt new tools",
  "We don't have the IT resources for integration",
  "How do you compare to [competitor]?",
  "Can you prove ROI?",
];

export default function ObjectionHandler() {
  const { toast } = useToast();

  const params = new URLSearchParams(window.location.hash.split("?")[1] || "");
  const initialProduct = params.get("product") || "";

  const [selectedProduct, setSelectedProduct] = useState(initialProduct);
  const [objectionText, setObjectionText] = useState("");
  const [context, setContext] = useState("");

  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });

  const { data: objectionHistory = [] } = useQuery<Objection[]>({
    queryKey: ["/api/objections"],
  });

  const handleObjection = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/objection/handle", {
        productSlug: selectedProduct,
        objection: objectionText,
        context: context || undefined,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/objections"] });
      toast({ title: "Response ready", description: "Counter-objection crafted." });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied", description: "Response copied to clipboard" });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
          <MessageSquareWarning className="w-5 h-5 text-amber-500" />
        </div>
        <div>
          <h1 className="text-xl font-bold">Objection Handler</h1>
          <p className="text-sm text-muted-foreground">Counter any pushback with AI-powered responses</p>
        </div>
      </div>

      <Tabs defaultValue="handle" className="space-y-4">
        <TabsList>
          <TabsTrigger value="handle" data-testid="tab-handle">
            <Zap className="w-3.5 h-3.5 mr-1.5" />
            Handle
          </TabsTrigger>
          <TabsTrigger value="history" data-testid="tab-obj-history">
            <History className="w-3.5 h-3.5 mr-1.5" />
            History ({objectionHistory.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="handle" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Input Panel */}
            <Card className="border-border/50 lg:col-span-1">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Objection Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Product */}
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block uppercase tracking-wider">Product</label>
                  <Select value={selectedProduct} onValueChange={setSelectedProduct}>
                    <SelectTrigger data-testid="select-obj-product">
                      <SelectValue placeholder="Select a product" />
                    </SelectTrigger>
                    <SelectContent>
                      {products.map(p => (
                        <SelectItem key={p.slug} value={p.slug}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Objection Input */}
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block uppercase tracking-wider">The Objection</label>
                  <Textarea
                    placeholder="Type the objection you're hearing from the prospect..."
                    value={objectionText}
                    onChange={e => setObjectionText(e.target.value)}
                    className="min-h-[100px] text-sm"
                    data-testid="input-objection"
                  />
                </div>

                {/* Quick Objections */}
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block uppercase tracking-wider">Quick Select</label>
                  <div className="flex flex-wrap gap-1.5">
                    {commonObjectionExamples.map((obj) => (
                      <button
                        key={obj}
                        onClick={() => setObjectionText(obj)}
                        className="text-[10px] px-2 py-1 rounded-md border border-border/50 text-muted-foreground hover:text-foreground hover:border-border transition-colors"
                        data-testid={`button-quick-obj-${obj.slice(0, 10).replace(/\s/g, "-")}`}
                      >
                        {obj}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Context */}
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block uppercase tracking-wider">Context (optional)</label>
                  <Textarea
                    placeholder="E.g., They're a hospital with 200 beds, currently using Epic..."
                    value={context}
                    onChange={e => setContext(e.target.value)}
                    className="min-h-[60px] text-sm"
                    data-testid="input-obj-context"
                  />
                </div>

                <Button
                  className="w-full"
                  onClick={() => handleObjection.mutate()}
                  disabled={!selectedProduct || !objectionText || handleObjection.isPending}
                  data-testid="button-handle-objection"
                >
                  {handleObjection.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Crafting response...
                    </>
                  ) : (
                    <>
                      <Zap className="w-4 h-4 mr-2" />
                      Destroy This Objection
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>

            {/* Response Panel */}
            <Card className="border-border/50 lg:col-span-2">
              <CardHeader className="pb-3 flex flex-row items-center justify-between">
                <CardTitle className="text-sm">AI Response</CardTitle>
                {objectionHistory.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(objectionHistory[0]?.response || "")}
                    data-testid="button-copy-response"
                  >
                    <Copy className="w-3.5 h-3.5 mr-1.5" />
                    Copy
                  </Button>
                )}
              </CardHeader>
              <CardContent>
                {handleObjection.isPending ? (
                  <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                    <Loader2 className="w-8 h-8 animate-spin text-primary mb-3" />
                    <p className="text-sm font-medium">Crafting your counter-response...</p>
                    <p className="text-xs mt-1">Analyzing objection patterns and evidence</p>
                  </div>
                ) : objectionHistory.length > 0 ? (
                  <div className="space-y-3">
                    <div className="flex gap-2 flex-wrap items-center">
                      <Badge variant="secondary">{products.find(p => p.id === objectionHistory[0]?.productId)?.name}</Badge>
                      {objectionHistory[0]?.category && (
                        <Badge className={categoryColors[objectionHistory[0].category] || "bg-muted"}>
                          {objectionHistory[0].category}
                        </Badge>
                      )}
                    </div>
                    <div className="p-3 rounded-lg bg-muted/30 border border-border/50 mb-3">
                      <p className="text-xs font-medium text-muted-foreground mb-1">OBJECTION:</p>
                      <p className="text-sm italic">"{objectionHistory[0]?.objection}"</p>
                    </div>
                    <div className="whitespace-pre-wrap text-sm leading-relaxed">
                      {objectionHistory[0]?.response}
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                    <MessageSquareWarning className="w-8 h-8 mb-3 opacity-40" />
                    <p className="text-sm">Enter an objection to get your counter-response</p>
                    <p className="text-xs mt-1">Select a product first, then describe the pushback</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="history" className="space-y-3">
          {objectionHistory.length === 0 ? (
            <Card className="border-border/50">
              <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <History className="w-8 h-8 mb-3 opacity-40" />
                <p className="text-sm">No objections handled yet</p>
              </CardContent>
            </Card>
          ) : (
            objectionHistory.map((obj) => {
              const product = products.find(p => p.id === obj.productId);
              const CatIcon = categoryIcons[obj.category] || AlertTriangle;
              return (
                <Card key={obj.id} className="border-border/50" data-testid={`card-objection-${obj.id}`}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex gap-2 flex-wrap">
                        <Badge variant="secondary">{product?.name || "Unknown"}</Badge>
                        <Badge className={categoryColors[obj.category] || "bg-muted"}>
                          <CatIcon className="w-3 h-3 mr-1" />
                          {obj.category}
                        </Badge>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => copyToClipboard(obj.response)}>
                        <Copy className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                    <div className="p-2 rounded bg-muted/30 mb-2">
                      <p className="text-xs italic text-muted-foreground">"{obj.objection}"</p>
                    </div>
                    <p className="text-sm whitespace-pre-wrap leading-relaxed line-clamp-4">{obj.response}</p>
                    <p className="text-[10px] text-muted-foreground mt-2">
                      {new Date(obj.createdAt).toLocaleString()}
                    </p>
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
