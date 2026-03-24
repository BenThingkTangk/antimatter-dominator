import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import {
  Atom, TrendingUp, MessageSquareWarning, Shield, Radar,
  Zap, Target, ArrowUpRight, Activity
} from "lucide-react";
import type { Product, Prospect } from "@shared/schema";

function StatCard({ title, value, icon: Icon, description, color }: {
  title: string; value: string | number; icon: any; description: string; color: string;
}) {
  return (
    <Card className="border-border/50" data-testid={`stat-${title.toLowerCase().replace(/\s/g, "-")}`}>
      <CardContent className="pt-5 pb-4 px-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{title}</p>
            <p className="text-2xl font-bold mt-1">{value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
          </div>
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${color}`}>
            <Icon className="w-5 h-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ProductCard({ product }: { product: Product }) {
  const categoryColors: Record<string, string> = {
    platform: "bg-primary/15 text-primary",
    "real-estate": "bg-chart-4/15 text-amber-500",
    healthcare: "bg-chart-3/15 text-emerald-500",
    cybersecurity: "bg-chart-5/15 text-rose-500",
  };

  return (
    <Card className="border-border/50 hover:border-primary/30 transition-colors group" data-testid={`card-product-${product.slug}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-2">
          <Badge variant="secondary" className={categoryColors[product.category] || "bg-muted"}>
            {product.category}
          </Badge>
          <a href={product.url} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary transition-colors">
            <ArrowUpRight className="w-4 h-4" />
          </a>
        </div>
        <h3 className="font-semibold text-sm mt-2">{product.name}</h3>
        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{product.tagline}</p>
        <div className="flex gap-1 mt-3">
          <Link href={`/pitch?product=${product.slug}`}>
            <Badge variant="outline" className="cursor-pointer hover:bg-primary/10 hover:text-primary text-[10px]">
              Pitch
            </Badge>
          </Link>
          <Link href={`/objections?product=${product.slug}`}>
            <Badge variant="outline" className="cursor-pointer hover:bg-primary/10 hover:text-primary text-[10px]">
              Objections
            </Badge>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });

  const { data: prospects = [] } = useQuery<Prospect[]>({
    queryKey: ["/api/prospects"],
  });

  const hotProspects = prospects.filter(p => p.score >= 75);
  const avgScore = prospects.length > 0
    ? Math.round(prospects.reduce((a, b) => a + b.score, 0) / prospects.length)
    : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Zap className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Command Center</h1>
            <p className="text-sm text-muted-foreground">Antimatter AI Sales Dominator</p>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Products"
          value={products.length}
          icon={Atom}
          description="In ecosystem"
          color="bg-primary/10 text-primary"
        />
        <StatCard
          title="Prospects"
          value={prospects.length}
          icon={Target}
          description={`${hotProspects.length} hot leads`}
          color="bg-chart-5/10 text-rose-500"
        />
        <StatCard
          title="Avg Score"
          value={avgScore}
          icon={Activity}
          description="Prospect quality"
          color="bg-chart-3/10 text-emerald-500"
        />
        <StatCard
          title="Pipeline"
          value={`$${(prospects.length * 85).toLocaleString()}K`}
          icon={TrendingUp}
          description="Est. total value"
          color="bg-chart-4/10 text-amber-500"
        />
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Link href="/pitch">
          <Card className="border-border/50 hover:border-primary/50 transition-all cursor-pointer group" data-testid="link-pitch-generator">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                <TrendingUp className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium">Pitch Generator</p>
                <p className="text-xs text-muted-foreground">Create killer pitches</p>
              </div>
            </CardContent>
          </Card>
        </Link>
        <Link href="/objections">
          <Card className="border-border/50 hover:border-primary/50 transition-all cursor-pointer group" data-testid="link-objection-handler">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-chart-4/10 flex items-center justify-center group-hover:bg-chart-4/20 transition-colors">
                <MessageSquareWarning className="w-4 h-4 text-amber-500" />
              </div>
              <div>
                <p className="text-sm font-medium">Objection Handler</p>
                <p className="text-xs text-muted-foreground">Destroy pushback</p>
              </div>
            </CardContent>
          </Card>
        </Link>
        <Link href="/market">
          <Card className="border-border/50 hover:border-primary/50 transition-all cursor-pointer group" data-testid="link-market-intent">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-chart-3/10 flex items-center justify-center group-hover:bg-chart-3/20 transition-colors">
                <Shield className="w-4 h-4 text-emerald-500" />
              </div>
              <div>
                <p className="text-sm font-medium">Market Intent</p>
                <p className="text-xs text-muted-foreground">Intelligence & trends</p>
              </div>
            </CardContent>
          </Card>
        </Link>
        <Link href="/prospects">
          <Card className="border-border/50 hover:border-primary/50 transition-all cursor-pointer group" data-testid="link-prospect-engine">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-chart-5/10 flex items-center justify-center group-hover:bg-chart-5/20 transition-colors">
                <Radar className="w-4 h-4 text-rose-500" />
              </div>
              <div>
                <p className="text-sm font-medium">Prospect Engine</p>
                <p className="text-xs text-muted-foreground">AI-powered pipeline</p>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Products Grid */}
      <div>
        <h2 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wider">Ecosystem Products</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
          {products.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      </div>

      {/* Top Prospects Preview */}
      {prospects.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Top Prospects</h2>
            <Link href="/prospects" className="text-xs text-primary hover:underline">View all</Link>
          </div>
          <div className="space-y-2">
            {prospects.slice(0, 5).map((p) => (
              <Card key={p.id} className="border-border/50" data-testid={`card-prospect-${p.id}`}>
                <CardContent className="p-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold text-sm ${
                      p.score >= 80 ? "bg-chart-5/15 text-rose-500" :
                      p.score >= 60 ? "bg-chart-4/15 text-amber-500" :
                      "bg-muted text-muted-foreground"
                    }`}>
                      {Math.round(p.score)}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{p.companyName}</p>
                      <p className="text-xs text-muted-foreground">{p.industry} · {p.companySize}</p>
                    </div>
                  </div>
                  <Badge variant={p.urgency === "critical" ? "destructive" : "secondary"} className="text-xs">
                    {p.urgency}
                  </Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
