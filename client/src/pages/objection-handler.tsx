import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { store, useObjections, type ObjectionEntry } from "@/lib/store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { MessageSquareWarning, Loader2, Copy, Zap, History, ShieldCheck, DollarSign, Clock, Users, AlertTriangle, Lock } from "lucide-react";
import type { Product } from "@shared/schema";

const categoryIcons: Record<string, any> = { price: DollarSign, competition: ShieldCheck, timing: Clock, authority: Users, need: AlertTriangle, trust: Lock };
const categoryColors: Record<string, string> = { price: "bg-amber-500/15 text-amber-500", competition: "bg-blue-500/15 text-blue-500", timing: "bg-purple-500/15 text-purple-500", authority: "bg-emerald-500/15 text-emerald-500", need: "bg-rose-500/15 text-rose-500", trust: "bg-cyan-500/15 text-cyan-500" };

const quickObjections = ["We already have something in place","It's too expensive","We're not ready for AI yet","I need to check with my boss","We've been burned by vendors before","Quantum threats aren't real yet","Our team won't adopt new tools","Can you prove ROI?"];

export default function ObjectionHandler() {
  const { toast } = useToast();
  const params = new URLSearchParams(window.location.hash.split("?")[1] || "");
  const [selectedProduct, setSelectedProduct] = useState(params.get("product") || "");
  const [objectionText, setObjectionText] = useState("");
  const [context, setContext] = useState("");
  const objectionHistory = useObjections();

  const { data: products = [] } = useQuery<Product[]>({ queryKey: ["/api/products"] });

  const handleObjection = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/objection/handle", { productSlug: selectedProduct, objection: objectionText, context: context || undefined });
      return res.json();
    },
    onSuccess: (data: ObjectionEntry) => {
      store.addObjection(data);
      toast({ title: "Response ready", description: "Counter-objection crafted." });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const copyToClipboard = (text: string) => { navigator.clipboard.writeText(text); toast({ title: "Copied" }); };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center"><MessageSquareWarning className="w-5 h-5 text-amber-500" /></div>
        <div><h1 className="text-xl font-bold">Objection Handler</h1><p className="text-sm text-muted-foreground">Counter any pushback with AI-powered responses</p></div>
      </div>

      <Tabs defaultValue="handle" className="space-y-4">
        <TabsList>
          <TabsTrigger value="handle"><Zap className="w-3.5 h-3.5 mr-1.5" />Handle</TabsTrigger>
          <TabsTrigger value="history"><History className="w-3.5 h-3.5 mr-1.5" />History ({objectionHistory.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="handle" className="space-y-4">
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
                {objectionHistory.length > 0 && <Button variant="ghost" size="sm" onClick={() => copyToClipboard(objectionHistory[0]?.response || "")}><Copy className="w-3.5 h-3.5 mr-1.5" />Copy</Button>}
              </CardHeader>
              <CardContent>
                {handleObjection.isPending ? (
                  <div className="flex flex-col items-center justify-center py-16 text-muted-foreground"><Loader2 className="w-8 h-8 animate-spin text-primary mb-3" /><p className="text-sm font-medium">Crafting your counter-response...</p></div>
                ) : objectionHistory.length > 0 ? (
                  <div className="space-y-3">
                    <div className="flex gap-2 flex-wrap items-center">
                      <Badge variant="secondary">{products.find((p) => p.id === objectionHistory[0]?.productId)?.name}</Badge>
                      <Badge className={categoryColors[objectionHistory[0].category] || "bg-muted"}>{objectionHistory[0].category}</Badge>
                    </div>
                    <div className="p-3 rounded-lg bg-muted/30 border border-border/50"><p className="text-xs font-medium text-muted-foreground mb-1">OBJECTION:</p><p className="text-sm italic">"{objectionHistory[0]?.objection}"</p></div>
                    <div className="whitespace-pre-wrap text-sm leading-relaxed">{objectionHistory[0]?.response}</div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-16 text-muted-foreground"><MessageSquareWarning className="w-8 h-8 mb-3 opacity-40" /><p className="text-sm">Enter an objection to get your counter-response</p></div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="history" className="space-y-3">
          {objectionHistory.length === 0 ? (
            <Card className="border-border/50"><CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground"><History className="w-8 h-8 mb-3 opacity-40" /><p className="text-sm">No objections handled yet</p></CardContent></Card>
          ) : objectionHistory.map((obj) => {
            const CatIcon = categoryIcons[obj.category] || AlertTriangle;
            return (
              <Card key={obj.id} className="border-border/50">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex gap-2 flex-wrap">
                      <Badge variant="secondary">{products.find((p) => p.id === obj.productId)?.name || "Unknown"}</Badge>
                      <Badge className={categoryColors[obj.category] || "bg-muted"}><CatIcon className="w-3 h-3 mr-1" />{obj.category}</Badge>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => copyToClipboard(obj.response)}><Copy className="w-3.5 h-3.5" /></Button>
                  </div>
                  <div className="p-2 rounded bg-muted/30 mb-2"><p className="text-xs italic text-muted-foreground">"{obj.objection}"</p></div>
                  <p className="text-sm whitespace-pre-wrap leading-relaxed line-clamp-4">{obj.response}</p>
                  <p className="text-[10px] text-muted-foreground mt-2">{new Date(obj.createdAt).toLocaleString()}</p>
                </CardContent>
              </Card>
            );
          })}
        </TabsContent>
      </Tabs>
    </div>
  );
}
