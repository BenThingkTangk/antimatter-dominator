import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { store, useProspects, type Prospect, type Contact } from "@/lib/store";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Radar, Loader2, Signal, ChevronDown, ChevronUp, Flame,
  Mail, Phone, Linkedin, User, Globe, RefreshCw, ShieldCheck, AlertCircle, CheckCircle2, PhoneCall
} from "lucide-react";
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

function VerificationBadge({ status }: { status: string }) {
  if (status === "valid") return <Badge className="bg-emerald-500/15 text-emerald-500 text-[9px] gap-0.5"><CheckCircle2 className="w-2.5 h-2.5" />verified</Badge>;
  if (status === "accept_all") return <Badge className="bg-amber-500/15 text-amber-500 text-[9px] gap-0.5"><ShieldCheck className="w-2.5 h-2.5" />accept-all</Badge>;
  return <Badge className="bg-muted text-muted-foreground text-[9px] gap-0.5"><AlertCircle className="w-2.5 h-2.5" />unverified</Badge>;
}

function ContactCard({ contact }: { contact: Contact }) {
  return (
    <div className="flex items-start gap-3 p-2.5 rounded-lg border border-border/50 bg-card/50">
      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
        <User className="w-4 h-4 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-medium">{contact.firstName} {contact.lastName}</p>
          <VerificationBadge status={contact.verification} />
        </div>
        {contact.position && <p className="text-xs text-muted-foreground mt-0.5">{contact.position}</p>}
        <div className="flex flex-wrap gap-2 mt-1.5">
          {contact.email && (
            <a href={`mailto:${contact.email}`} className="flex items-center gap-1 text-[11px] text-primary hover:underline" target="_blank" rel="noopener noreferrer">
              <Mail className="w-3 h-3" />{contact.email}
            </a>
          )}
          {contact.linkedin && (
            <a href={contact.linkedin} className="flex items-center gap-1 text-[11px] text-blue-500 hover:underline" target="_blank" rel="noopener noreferrer">
              <Linkedin className="w-3 h-3" />LinkedIn
            </a>
          )}
          {contact.phone && (
            <a href={`tel:${contact.phone}`} className="flex items-center gap-1 text-[11px] text-emerald-400 hover:underline">
              <Phone className="w-3 h-3" />{contact.phone}
            </a>
          )}
          {(contact as any).mobilePhone && (contact as any).mobilePhone !== contact.phone && (
            <a href={`tel:${(contact as any).mobilePhone}`} className="flex items-center gap-1 text-[11px] text-green-400 hover:underline">
              <Phone className="w-3 h-3" />📱 {(contact as any).mobilePhone}
            </a>
          )}
        </div>
        {(contact as any).city && (
          <p className="text-[10px] text-muted-foreground mt-0.5">📍 {(contact as any).city}{(contact as any).state ? `, ${(contact as any).state}` : ''}</p>
        )}
        <div className="flex gap-1.5 mt-1">
          {contact.seniority && <Badge variant="outline" className="text-[9px]">{contact.seniority}</Badge>}
          {contact.department && <Badge variant="outline" className="text-[9px]">{contact.department}</Badge>}
          <Badge variant="outline" className="text-[9px]">{contact.confidence}% confidence</Badge>
          {(contact as any).source && (
            <Badge className={`text-[9px] ${(contact as any).source === 'apollo' ? 'bg-purple-500/15 text-purple-400' : (contact as any).source === 'both' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-orange-500/15 text-orange-400'}`}>
              ATOM Verified
            </Badge>
          )}
        </div>
      </div>
    </div>
  );
}

function ProspectCard({ prospect, products }: { prospect: Prospect; products: Product[] }) {
  const [expanded, setExpanded] = useState(false);
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const matchedProducts = JSON.parse(prospect.matchedProducts || "[]") as string[];
  const signals = JSON.parse(prospect.signals || "[]") as string[];
  const contacts = JSON.parse(prospect.contacts || "[]") as Contact[];

  const enrichMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/prospects/enrich", {
        companyName: prospect.companyName,
        domain: prospect.domain || undefined,
      });
      return res.json();
    },
    onSuccess: (data: any) => {
      store.updateProspectContacts(prospect.id, JSON.stringify(data.contacts || []));
      toast({ title: "Enriched", description: `Found ${data.contacts?.length || 0} decision makers at ${prospect.companyName}` });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  return (
    <Card className={`border-border/50 transition-all ${prospect.score >= 80 ? "border-l-2 border-l-rose-500" : prospect.score >= 60 ? "border-l-2 border-l-amber-500" : ""}`}>
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              {prospect.score >= 80 && <Flame className="w-4 h-4 text-rose-500 shrink-0" />}
              <h3 className="font-semibold text-sm truncate">{prospect.companyName}</h3>
              {prospect.domain && (
                <a href={`https://${prospect.domain}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-0.5 text-[10px] text-muted-foreground hover:text-primary">
                  <Globe className="w-3 h-3" />{prospect.domain}
                </a>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5 mb-2">
              <Badge variant="outline" className="text-[10px]">{prospect.industry}</Badge>
              <Badge variant="outline" className="text-[10px]">{prospect.companySize}</Badge>
              <Badge className={`text-[10px] ${urgencyColors[prospect.urgency]}`}>{prospect.urgency}</Badge>
              <Badge className={`text-[10px] ${statusColors[prospect.status]}`}>{prospect.status}</Badge>
              {contacts.length > 0 && (
                <Badge className="bg-emerald-500/15 text-emerald-500 text-[10px] gap-0.5">
                  <User className="w-3 h-3" />{contacts.length} contacts
                </Badge>
              )}
            </div>
            <ScoreBar score={prospect.score} />
          </div>
          <Button variant="ghost" size="sm" onClick={() => setExpanded(!expanded)} className="shrink-0">
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </Button>
        </div>

        {/* Always-visible contacts summary + Call with ATOM */}
        {contacts.length > 0 && !expanded && (
          <div className="mt-2 pt-2 border-t border-border/30 space-y-1.5">
            {contacts.slice(0, 2).map((c, i) => (
              <div key={i} className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <User className="w-3 h-3 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-medium truncate">{c.firstName} {c.lastName}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{c.position}</p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-[10px] gap-1 text-primary border-primary/30 hover:bg-primary/10 shrink-0"
                  onClick={() => {
                    const mp = JSON.parse(prospect.matchedProducts || "[]") as string[];
                    const params = new URLSearchParams({
                      company: prospect.companyName,
                      contact: `${c.firstName} ${c.lastName}`,
                      title: c.position || "",
                      phone: c.phone || "",
                      product: mp[0] || "",
                    });
                    navigate(`/atom-leadgen?${params.toString()}`);
                  }}
                >
                  <PhoneCall className="w-3 h-3" />
                  Call with ATOM
                </Button>
              </div>
            ))}
            {contacts.length > 2 && (
              <p className="text-[10px] text-muted-foreground">+{contacts.length - 2} more — expand to see all</p>
            )}
          </div>
        )}

        {/* Find Contacts prompt when no contacts yet */}
        {contacts.length === 0 && !expanded && (
          <div className="mt-2 pt-2 border-t border-border/30">
            <Button variant="outline" size="sm" className="w-full h-7 text-xs gap-1" onClick={() => enrichMutation.mutate()} disabled={enrichMutation.isPending}>
              {enrichMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
              {enrichMutation.isPending ? "Finding decision makers..." : "Find Decision Makers"}
            </Button>
          </div>
        )}

        {expanded && (
          <div className="mt-3 pt-3 border-t border-border/50 space-y-3">
            <div><p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1">Why They Need Us</p><p className="text-sm leading-relaxed">{prospect.reason}</p></div>

            {signals.length > 0 && (
              <div><p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1">Market Signals</p>
                {signals.map((s, i) => <div key={i} className="flex items-start gap-2"><Signal className="w-3 h-3 text-primary mt-0.5 shrink-0" /><p className="text-xs text-muted-foreground">{s}</p></div>)}
              </div>
            )}

            {matchedProducts.length > 0 && (
              <div><p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1">Recommended Products</p>
                <div className="flex flex-wrap gap-1.5">{matchedProducts.map(slug => <Badge key={slug} variant="secondary" className="text-[10px]">{products.find(p => p.slug === slug)?.name || slug}</Badge>)}</div>
              </div>
            )}

            {/* Decision Makers Section */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Decision Makers</p>
                <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => enrichMutation.mutate()} disabled={enrichMutation.isPending}>
                  {enrichMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                  {contacts.length > 0 ? "Refresh" : "Find Contacts"}
                </Button>
              </div>
              {contacts.length > 0 ? (
                <div className="space-y-2">
                  {contacts.map((c, i) => (
                    <div key={i} className="relative">
                      <ContactCard contact={c} />
                      <Button
                        variant="outline"
                        size="sm"
                        className="absolute top-2 right-2 h-7 text-[10px] gap-1 text-primary border-primary/30 hover:bg-primary/10"
                        onClick={() => {
                          const matchedProducts = JSON.parse(prospect.matchedProducts || "[]") as string[];
                          const params = new URLSearchParams({
                            company: prospect.companyName,
                            contact: `${c.firstName} ${c.lastName}`,
                            title: c.position || "",
                            product: matchedProducts[0] || "",
                          });
                          navigate(`/atom-leadgen?${params.toString()}`);
                        }}
                      >
                        <PhoneCall className="w-3 h-3" />
                        Call with ATOM
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-3 rounded-lg border border-dashed border-border/50 text-center">
                  <p className="text-xs text-muted-foreground">
                    {enrichMutation.isPending ? "ATOM enriching decision makers..." : "Click \"Find Contacts\" to discover key decision makers via ATOM enrichment"}
                  </p>
                </div>
              )}
            </div>

            {/* Status controls */}
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
      const totalContacts = data.reduce((sum, p) => sum + (JSON.parse(p.contacts || "[]")).length, 0);
      toast({ title: "Scan complete", description: `Found ${data.length} prospects with ${totalContacts} decision makers` });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const hot = prospects.filter(p => p.score >= 75);
  const warm = prospects.filter(p => p.score >= 50 && p.score < 75);
  const cold = prospects.filter(p => p.score < 50);
  const totalContacts = prospects.reduce((sum, p) => sum + (JSON.parse(p.contacts || "[]")).length, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-rose-500/10 flex items-center justify-center"><Radar className="w-5 h-5 text-rose-500" /></div>
        <div><h1 className="text-xl font-bold">Prospect Engine</h1><p className="text-sm text-muted-foreground">AI prospect discovery + ATOM proprietary decision maker enrichment</p></div>
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
              <input
                type="text"
                value={productFocus}
                onChange={(e) => setProductFocus(e.target.value)}
                placeholder="e.g. Akamai, Five9, TierPoint, Antimatter AI..."
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
            <Button onClick={() => scanProspects.mutate()} disabled={scanProspects.isPending} className="sm:w-auto w-full">
              {scanProspects.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Scanning...</> : <><Radar className="w-4 h-4 mr-2" />Scan + Enrich</>}
            </Button>
          </div>
          {scanProspects.isPending && <div className="mt-3 p-3 rounded-lg bg-primary/5 border border-primary/20"><div className="flex items-center gap-2 text-sm text-primary"><Radar className="w-4 h-4 animate-pulse" /><span className="font-medium">ATOM scanning prospects and enriching decision makers...</span></div></div>}
        </div>
      </Card>

      {prospects.length > 0 && (
        <div className="grid grid-cols-4 gap-3">
          <Card className="border-border/50 border-l-2 border-l-rose-500"><div className="p-3 text-center"><p className="text-2xl font-bold text-rose-500">{hot.length}</p><p className="text-[10px] text-muted-foreground uppercase tracking-wider">Hot (75+)</p></div></Card>
          <Card className="border-border/50 border-l-2 border-l-amber-500"><div className="p-3 text-center"><p className="text-2xl font-bold text-amber-500">{warm.length}</p><p className="text-[10px] text-muted-foreground uppercase tracking-wider">Warm (50-74)</p></div></Card>
          <Card className="border-border/50 border-l-2 border-l-blue-500"><div className="p-3 text-center"><p className="text-2xl font-bold text-blue-500">{cold.length}</p><p className="text-[10px] text-muted-foreground uppercase tracking-wider">Cold (&lt;50)</p></div></Card>
          <Card className="border-border/50 border-l-2 border-l-emerald-500"><div className="p-3 text-center"><p className="text-2xl font-bold text-emerald-500">{totalContacts}</p><p className="text-[10px] text-muted-foreground uppercase tracking-wider">Contacts</p></div></Card>
        </div>
      )}

      {prospects.length > 0 ? (
        <div className="space-y-2">{prospects.map(p => <ProspectCard key={p.id} prospect={p} products={products} />)}</div>
      ) : (
        <Card className="border-border/50"><div className="flex flex-col items-center justify-center py-16 text-muted-foreground"><Radar className="w-8 h-8 mb-3 opacity-40" /><p className="text-sm">No prospects yet — scan to discover targets with decision maker contacts</p></div></Card>
      )}
    </div>
  );
}
