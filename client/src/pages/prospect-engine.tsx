import { useState, useEffect, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { store, useProspects, type Prospect, type Contact } from "@/lib/store";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  Radar,
  Loader2,
  Signal,
  ChevronDown,
  ChevronUp,
  Flame,
  Mail,
  Phone,
  Linkedin,
  User,
  Globe,
  RefreshCw,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  PhoneCall,
  History,
  Plus,
  Download,
  Search,
  SlidersHorizontal,
  X,
  Building2,
  Users,
  DollarSign,
  MapPin,
  Cpu,
  Tag,
  Briefcase,
  ChevronLeft,
  ChevronRight,
  Trash2,
} from "lucide-react";

// ─── Constants ──────────────────────────────────────────────────────────────

const INDUSTRIES = [
  "All Industries",
  "Technology & SaaS",
  "Healthcare & Life Sciences",
  "Financial Services & Banking",
  "Real Estate & PropTech",
  "Manufacturing",
  "Retail & E-Commerce",
  "Insurance",
  "Defense & Government",
  "Energy & Utilities",
  "Education & EdTech",
  "Transportation & Logistics",
  "Media & Entertainment",
  "Telecommunications",
  "Legal Services",
  "Construction & Engineering",
  "Agriculture & Food Tech",
  "Hospitality & Travel",
  "Non-Profit & NGO",
  "Automotive",
  "Aerospace",
  "Cybersecurity",
  "Biotech & Pharma",
];

const GEOGRAPHIES = [
  { value: "All US", label: "All US" },
  { value: "US South", label: "US South (TX, FL, GA, NC, TN...)" },
  { value: "US Northeast", label: "US Northeast (NY, NJ, MA, CT, PA...)" },
  { value: "US Midwest", label: "US Midwest (IL, OH, MI, IN, MN...)" },
  { value: "US West", label: "US West (CA, WA, OR, CO, AZ...)" },
  { value: "US Southeast", label: "US Southeast (FL, GA, NC, SC, VA...)" },
  { value: "Texas", label: "Texas" },
  { value: "California", label: "California" },
  { value: "New York", label: "New York" },
  { value: "Florida", label: "Florida" },
  { value: "Illinois", label: "Illinois" },
  { value: "Georgia", label: "Georgia" },
  { value: "North Carolina", label: "North Carolina" },
  { value: "Washington", label: "Washington" },
  { value: "Massachusetts", label: "Massachusetts" },
  { value: "Colorado", label: "Colorado" },
  { value: "Arizona", label: "Arizona" },
  { value: "Tennessee", label: "Tennessee" },
  { value: "Pennsylvania", label: "Pennsylvania" },
  { value: "Ohio", label: "Ohio" },
  { value: "EU", label: "EU (Germany, France, Netherlands...)" },
  { value: "UK", label: "United Kingdom" },
  { value: "Canada", label: "Canada" },
  { value: "Global", label: "Global" },
];

const EMPLOYEE_SIZES = [
  { value: "", label: "Any Size" },
  { value: "1-10", label: "1–10 employees" },
  { value: "11-50", label: "11–50 employees" },
  { value: "51-200", label: "51–200 employees" },
  { value: "201-500", label: "201–500 employees" },
  { value: "501-1000", label: "501–1,000 employees" },
  { value: "1001-5000", label: "1,001–5,000 employees" },
  { value: "5001-10000", label: "5,001–10,000 employees" },
  { value: "10001+", label: "10,000+ employees" },
];

const REVENUE_RANGES = [
  { value: "", label: "Any Revenue" },
  { value: "under-1m", label: "Under $1M" },
  { value: "1m-10m", label: "$1M – $10M" },
  { value: "10m-50m", label: "$10M – $50M" },
  { value: "50m-100m", label: "$50M – $100M" },
  { value: "100m-500m", label: "$100M – $500M" },
  { value: "500m-1b", label: "$500M – $1B" },
  { value: "1b+", label: "$1B+" },
];

const JOB_TITLES = [
  "CEO",
  "CTO",
  "CIO",
  "CISO",
  "CFO",
  "COO",
  "VP Engineering",
  "VP Sales",
  "VP Operations",
  "VP IT",
  "Director of IT",
  "Director of Engineering",
  "Head of AI",
  "Head of Technology",
  "Chief Digital Officer",
  "Chief Innovation Officer",
  "SVP Technology",
  "Managing Director",
  "President",
  "Owner",
  "Founder",
];

const STORAGE_KEY = "atom_prospect_history";
const PAGE_SIZE = 10;

// ─── Types ──────────────────────────────────────────────────────────────────

interface ScanFilters {
  industry: string;
  geo: string;
  employeeSize: string;
  revenueRange: string;
  productFocus: string;
  jobTitles: string[];
  techStack: string;
  keywords: string;
}

interface LocalProspectEntry {
  id: string;
  filters: ScanFilters;
  prospects: Prospect[];
  timestamp: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

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
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function loadHistory(): LocalProspectEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveHistory(entries: LocalProspectEntry[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {}
}

function filterSummary(filters: ScanFilters): string {
  const parts: string[] = [];
  if (filters.industry && filters.industry !== "All Industries")
    parts.push(filters.industry);
  if (filters.geo && filters.geo !== "All US") parts.push(filters.geo);
  if (filters.employeeSize) parts.push(filters.employeeSize + " emp");
  if (filters.revenueRange) parts.push(filters.revenueRange);
  if (filters.productFocus) parts.push(`"${filters.productFocus}"`);
  if (filters.jobTitles.length > 0)
    parts.push(filters.jobTitles.slice(0, 2).join(", "));
  if (filters.techStack) parts.push(filters.techStack);
  if (filters.keywords) parts.push(filters.keywords);
  return parts.length > 0 ? parts.join(" · ") : "All prospects";
}

function exportToCSV(prospects: Prospect[]) {
  const rows: string[] = [];
  rows.push(
    [
      "Company",
      "Domain",
      "Industry",
      "Score",
      "Company Size",
      "Employee Count",
      "Revenue",
      "Urgency",
      "Status",
      "Contact Name",
      "Contact Title",
      "Email",
      "Phone",
      "LinkedIn",
      "Reason",
    ].join(",")
  );

  for (const p of prospects) {
    const contacts: Contact[] = JSON.parse(p.contacts || "[]");
    if (contacts.length === 0) {
      rows.push(
        [
          `"${p.companyName}"`,
          p.domain,
          `"${p.industry}"`,
          p.score,
          p.companySize,
          (p as any).employeeCount || "",
          `"${(p as any).revenue || ""}"`,
          p.urgency,
          p.status,
          "",
          "",
          "",
          "",
          "",
          `"${p.reason.replace(/"/g, "'")}"`,
        ].join(",")
      );
    } else {
      for (const c of contacts) {
        rows.push(
          [
            `"${p.companyName}"`,
            p.domain,
            `"${p.industry}"`,
            p.score,
            p.companySize,
            (p as any).employeeCount || "",
            `"${(p as any).revenue || ""}"`,
            p.urgency,
            p.status,
            `"${c.firstName} ${c.lastName}"`,
            `"${c.position}"`,
            c.email,
            c.phone || "",
            c.linkedin || "",
            `"${p.reason.replace(/"/g, "'")}"`,
          ].join(",")
        );
      }
    }
  }

  const blob = new Blob([rows.join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `prospects-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function ScoreBar({ score }: { score: number }) {
  const color =
    score >= 80
      ? "bg-rose-500"
      : score >= 60
      ? "bg-amber-500"
      : "bg-[#696aac]";
  return (
    <div className="flex items-center gap-2 w-full">
      <div className="flex-1 h-1.5 rounded-full bg-white/5 overflow-hidden">
        <div
          className={`h-full rounded-full ${color} transition-all duration-700`}
          style={{ width: `${score}%` }}
        />
      </div>
      <span
        className={`text-xs font-bold tabular-nums ${
          score >= 80
            ? "text-rose-500"
            : score >= 60
            ? "text-amber-500"
            : "text-[#a2a3e9]"
        }`}
      >
        {Math.round(score)}
      </span>
    </div>
  );
}

function VerificationBadge({ status }: { status: string }) {
  if (status === "valid" || status === "verified")
    return (
      <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/20 text-[9px] gap-0.5 px-1.5">
        <CheckCircle2 className="w-2.5 h-2.5" />
        verified
      </Badge>
    );
  if (status === "accept_all")
    return (
      <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/20 text-[9px] gap-0.5 px-1.5">
        <ShieldCheck className="w-2.5 h-2.5" />
        accept-all
      </Badge>
    );
  return (
    <Badge className="bg-white/5 text-white/40 border-white/10 text-[9px] gap-0.5 px-1.5">
      <AlertCircle className="w-2.5 h-2.5" />
      unverified
    </Badge>
  );
}

function ContactRow({
  contact,
  prospect,
  compact = false,
}: {
  contact: Contact;
  prospect: Prospect;
  compact?: boolean;
}) {
  const [, navigate] = useLocation();
  const matchedProducts = JSON.parse(prospect.matchedProducts || "[]") as string[];

  const handleCallAtom = () => {
    const params = new URLSearchParams({
      company: prospect.companyName,
      contact: `${contact.firstName} ${contact.lastName}`,
      title: contact.position || "",
      phone: contact.phone || "",
      product: matchedProducts[0] || "",
    });
    navigate(`/atom-leadgen?${params.toString()}`);
  };

  if (compact) {
    return (
      <div className="flex items-center justify-between gap-2 py-1.5">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-6 h-6 rounded-full bg-[#696aac]/10 border border-[#696aac]/20 flex items-center justify-center shrink-0">
            <User className="w-3 h-3 text-[#a2a3e9]" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium truncate text-white/90">
              {contact.firstName} {contact.lastName}
            </p>
            <p className="text-[10px] text-white/40 truncate">{contact.position}</p>
          </div>
        </div>
        <Button
          size="sm"
          className="h-7 text-[10px] gap-1 bg-[#696aac] hover:bg-[#7b7cb8] border-0 shrink-0 transition-colors"
          onClick={handleCallAtom}
          data-testid={`button-call-atom-${prospect.id}-compact`}
        >
          <PhoneCall className="w-3 h-3" />
          Call with ATOM
        </Button>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-white/[0.07] bg-white/[0.03] p-3 group hover:border-[#696aac]/30 hover:bg-[#696aac]/5 transition-all">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-full bg-[#696aac]/10 border border-[#696aac]/20 flex items-center justify-center shrink-0">
          <User className="w-4 h-4 text-[#a2a3e9]" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-semibold text-white/90">
                  {contact.firstName} {contact.lastName}
                </p>
                <VerificationBadge status={contact.verification} />
              </div>
              {contact.position && (
                <p className="text-xs text-white/50 mt-0.5">{contact.position}</p>
              )}
            </div>
            <Button
              size="sm"
              className="h-7 text-[10px] gap-1 bg-[#696aac] hover:bg-[#7b7cb8] border-0 shrink-0 transition-colors shadow-lg shadow-[#696aac]/20"
              onClick={handleCallAtom}
              data-testid={`button-call-atom-${prospect.id}`}
            >
              <PhoneCall className="w-3 h-3" />
              Call with ATOM
            </Button>
          </div>

          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
            {contact.email && (
              <a
                href={`mailto:${contact.email}`}
                className="flex items-center gap-1 text-[11px] text-[#a2a3e9] hover:text-[#c4c5f0] transition-colors"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Mail className="w-3 h-3" />
                {contact.email}
              </a>
            )}
            {contact.phone && (
              <a
                href={`tel:${contact.phone}`}
                className="flex items-center gap-1 text-[11px] text-emerald-400 hover:text-emerald-300 transition-colors"
              >
                <Phone className="w-3 h-3" />
                {contact.phone}
              </a>
            )}
            {(contact as any).mobilePhone &&
              (contact as any).mobilePhone !== contact.phone && (
                <a
                  href={`tel:${(contact as any).mobilePhone}`}
                  className="flex items-center gap-1 text-[11px] text-green-400 hover:text-green-300 transition-colors"
                >
                  <Phone className="w-3 h-3" />
                  {(contact as any).mobilePhone} (mobile)
                </a>
              )}
            {contact.linkedin && (
              <a
                href={contact.linkedin}
                className="flex items-center gap-1 text-[11px] text-blue-400 hover:text-blue-300 transition-colors"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Linkedin className="w-3 h-3" />
                LinkedIn
              </a>
            )}
          </div>

          {(contact as any).city && (
            <p className="text-[10px] text-white/30 mt-1.5">
              <MapPin className="w-2.5 h-2.5 inline mr-0.5" />
              {(contact as any).city}
              {(contact as any).state ? `, ${(contact as any).state}` : ""}
            </p>
          )}

          <div className="flex gap-1.5 mt-1.5 flex-wrap">
            {contact.seniority && (
              <Badge className="bg-white/5 text-white/50 border-white/10 text-[9px]">
                {contact.seniority}
              </Badge>
            )}
            {contact.department && (
              <Badge className="bg-white/5 text-white/50 border-white/10 text-[9px]">
                {contact.department}
              </Badge>
            )}
            {contact.confidence > 0 && (
              <Badge className="bg-white/5 text-white/50 border-white/10 text-[9px]">
                {contact.confidence}% confidence
              </Badge>
            )}
            {(contact as any).source && (
              <Badge
                className={`text-[9px] ${
                  (contact as any).source === "apollo"
                    ? "bg-[#696aac]/15 text-[#a2a3e9] border-[#696aac]/30"
                    : (contact as any).source === "both"
                    ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/20"
                    : "bg-orange-500/15 text-orange-400 border-orange-500/20"
                }`}
              >
                ATOM Verified
              </Badge>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ProspectCard({ prospect }: { prospect: Prospect }) {
  const [expanded, setExpanded] = useState(false);
  const { toast } = useToast();
  const signals = JSON.parse(prospect.signals || "[]") as string[];
  const contacts = JSON.parse(prospect.contacts || "[]") as Contact[];
  const matchedProducts = JSON.parse(prospect.matchedProducts || "[]") as string[];

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
      toast({
        title: "Enriched",
        description: `Found ${data.contacts?.length || 0} decision makers at ${prospect.companyName}`,
      });
    },
    onError: (err: Error) =>
      toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const urgencyColor =
    prospect.urgency === "critical"
      ? "bg-rose-500/15 text-rose-400 border-rose-500/20"
      : prospect.urgency === "high"
      ? "bg-amber-500/15 text-amber-400 border-amber-500/20"
      : prospect.urgency === "medium"
      ? "bg-blue-500/15 text-blue-400 border-blue-500/20"
      : "bg-white/5 text-white/40 border-white/10";

  const borderColor =
    prospect.score >= 80
      ? "border-l-rose-500"
      : prospect.score >= 60
      ? "border-l-amber-500"
      : "border-l-[#696aac]/40";

  return (
    <div
      className={`rounded-xl border border-l-2 ${borderColor} border-white/[0.08] bg-black/40 backdrop-blur-md overflow-hidden transition-all hover:border-white/[0.14] hover:bg-black/50`}
      data-testid={`card-prospect-${prospect.id}`}
    >
      {/* Card Header */}
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              {prospect.score >= 80 && (
                <Flame className="w-4 h-4 text-rose-500 shrink-0" />
              )}
              <h3 className="font-semibold text-sm text-white/95 truncate">
                {prospect.companyName}
              </h3>
              {prospect.domain && (
                <a
                  href={`https://${prospect.domain}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-0.5 text-[10px] text-white/30 hover:text-[#a2a3e9] transition-colors shrink-0"
                >
                  <Globe className="w-3 h-3" />
                  {prospect.domain}
                </a>
              )}
            </div>

            <div className="flex flex-wrap gap-1.5 mb-3">
              <Badge className="bg-white/5 text-white/60 border-white/10 text-[10px] gap-1">
                <Building2 className="w-2.5 h-2.5" />
                {prospect.industry}
              </Badge>
              <Badge className="bg-white/5 text-white/60 border-white/10 text-[10px] gap-1">
                <Users className="w-2.5 h-2.5" />
                {prospect.companySize}
              </Badge>
              {(prospect as any).employeeCount > 0 && (
                <Badge className="bg-white/5 text-white/50 border-white/10 text-[10px]">
                  {(prospect as any).employeeCount.toLocaleString()} emp
                </Badge>
              )}
              {(prospect as any).revenue && (
                <Badge className="bg-white/5 text-white/50 border-white/10 text-[10px] gap-1">
                  <DollarSign className="w-2.5 h-2.5" />
                  {(prospect as any).revenue}
                </Badge>
              )}
              <Badge className={`text-[10px] ${urgencyColor}`}>
                {prospect.urgency}
              </Badge>
              {contacts.length > 0 && (
                <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/20 text-[10px] gap-0.5">
                  <User className="w-3 h-3" />
                  {contacts.length} contacts
                </Badge>
              )}
            </div>

            <ScoreBar score={prospect.score} />
          </div>
          <button
            onClick={() => setExpanded(!expanded)}
            className="shrink-0 w-8 h-8 rounded-lg border border-white/10 flex items-center justify-center text-white/40 hover:text-white/80 hover:border-white/20 transition-all"
            data-testid={`button-expand-${prospect.id}`}
          >
            {expanded ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </button>
        </div>

        {/* Quick contacts preview (collapsed) */}
        {contacts.length > 0 && !expanded && (
          <div className="mt-3 pt-3 border-t border-white/[0.06] space-y-1">
            {contacts.slice(0, 2).map((c, i) => (
              <ContactRow key={i} contact={c} prospect={prospect} compact />
            ))}
            {contacts.length > 2 && (
              <button
                onClick={() => setExpanded(true)}
                className="text-[10px] text-white/30 hover:text-[#a2a3e9] transition-colors"
              >
                +{contacts.length - 2} more — expand to see all
              </button>
            )}
          </div>
        )}

        {/* No contacts CTA */}
        {contacts.length === 0 && !expanded && (
          <div className="mt-3 pt-3 border-t border-white/[0.06]">
            <Button
              variant="outline"
              size="sm"
              className="w-full h-8 text-xs gap-1.5 border-white/10 text-white/50 hover:text-white/80 hover:border-[#696aac]/40 hover:bg-[#696aac]/5"
              onClick={() => enrichMutation.mutate()}
              disabled={enrichMutation.isPending}
              data-testid={`button-find-contacts-${prospect.id}`}
            >
              {enrichMutation.isPending ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <RefreshCw className="w-3 h-3" />
              )}
              {enrichMutation.isPending
                ? "Finding decision makers..."
                : "Find Decision Makers"}
            </Button>
          </div>
        )}
      </div>

      {/* Expanded content */}
      {expanded && (
        <div className="px-5 pb-5 space-y-4 border-t border-white/[0.06] pt-4">
          {/* Why they need us */}
          <div>
            <p className="text-[10px] font-semibold text-white/30 uppercase tracking-widest mb-1.5">
              Why They Need This
            </p>
            <p className="text-sm text-white/70 leading-relaxed">{prospect.reason}</p>
          </div>

          {/* Signals */}
          {signals.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-white/30 uppercase tracking-widest mb-1.5">
                Buying Signals
              </p>
              <div className="space-y-1">
                {signals.map((s, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <Signal className="w-3 h-3 text-[#a2a3e9] mt-0.5 shrink-0" />
                    <p className="text-xs text-white/60">{s}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Matched products */}
          {matchedProducts.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-white/30 uppercase tracking-widest mb-1.5">
                Matched Products
              </p>
              <div className="flex flex-wrap gap-1.5">
                {matchedProducts.map((slug) => (
                  <Badge
                    key={slug}
                    className="bg-[#696aac]/15 text-[#a2a3e9] border-[#696aac]/30 text-[10px]"
                  >
                    {slug}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Decision Makers */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-semibold text-white/30 uppercase tracking-widest">
                Decision Makers
              </p>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs gap-1 border-white/10 text-white/50 hover:text-white/80 hover:border-[#696aac]/40 hover:bg-[#696aac]/5"
                onClick={() => enrichMutation.mutate()}
                disabled={enrichMutation.isPending}
                data-testid={`button-refresh-contacts-${prospect.id}`}
              >
                {enrichMutation.isPending ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <RefreshCw className="w-3 h-3" />
                )}
                {contacts.length > 0 ? "Refresh" : "Find Contacts"}
              </Button>
            </div>

            {contacts.length > 0 ? (
              <div className="space-y-2">
                {contacts.map((c, i) => (
                  <ContactRow key={i} contact={c} prospect={prospect} />
                ))}
              </div>
            ) : (
              <div className="p-4 rounded-lg border border-dashed border-white/10 text-center">
                <p className="text-xs text-white/30">
                  {enrichMutation.isPending
                    ? "ATOM enriching decision makers..."
                    : 'Click "Find Contacts" to discover key decision makers'}
                </p>
              </div>
            )}
          </div>

          {/* Status controls */}
          <div className="flex items-center gap-2 pt-1">
            <p className="text-[10px] font-semibold text-white/30 uppercase tracking-widest shrink-0">
              Status:
            </p>
            <div className="flex gap-1 flex-wrap">
              {["new", "contacted", "engaged", "qualified", "closed"].map((s) => (
                <button
                  key={s}
                  onClick={() => store.updateProspectStatus(prospect.id, s)}
                  className={`text-[10px] px-2.5 py-1 rounded-md border transition-all ${
                    prospect.status === s
                      ? "bg-[#696aac]/20 text-[#a2a3e9] border-[#696aac]/40"
                      : "border-white/10 text-white/30 hover:text-white/60 hover:border-white/20"
                  }`}
                  data-testid={`button-status-${s}-${prospect.id}`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-3">
      {[...Array(5)].map((_, i) => (
        <div
          key={i}
          className="rounded-xl border border-l-2 border-l-[#696aac]/30 border-white/[0.08] bg-black/40 backdrop-blur-md p-5"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 space-y-3">
              <div className="flex gap-2 items-center">
                <Skeleton className="h-4 w-48 bg-white/5" />
                <Skeleton className="h-3 w-24 bg-white/5" />
              </div>
              <div className="flex gap-1.5">
                <Skeleton className="h-5 w-24 rounded-full bg-white/5" />
                <Skeleton className="h-5 w-20 rounded-full bg-white/5" />
                <Skeleton className="h-5 w-16 rounded-full bg-white/5" />
              </div>
              <Skeleton className="h-1.5 w-full rounded-full bg-white/5" />
            </div>
            <Skeleton className="h-8 w-8 rounded-lg bg-white/5" />
          </div>
          <div className="mt-3 pt-3 border-t border-white/[0.04] space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Skeleton className="h-6 w-6 rounded-full bg-white/5" />
                <div className="space-y-1">
                  <Skeleton className="h-3 w-32 bg-white/5" />
                  <Skeleton className="h-2 w-24 bg-white/5" />
                </div>
              </div>
              <Skeleton className="h-7 w-28 rounded-md bg-[#696aac]/10" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function TitleBadge({ title, onRemove }: { title: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#696aac]/15 text-[#a2a3e9] border border-[#696aac]/30 text-xs">
      {title}
      <button onClick={onRemove} className="hover:text-white transition-colors ml-0.5">
        <X className="w-2.5 h-2.5" />
      </button>
    </span>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function ProspectEngine() {
  const { toast } = useToast();
  const prospects = useProspects();

  // Filters
  const [filters, setFilters] = useState<ScanFilters>({
    industry: "All Industries",
    geo: "All US",
    employeeSize: "",
    revenueRange: "",
    productFocus: "",
    jobTitles: [],
    techStack: "",
    keywords: "",
  });
  const [titleInput, setTitleInput] = useState("");

  // View state
  const [showHistory, setShowHistory] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [excludedCompanies, setExcludedCompanies] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);

  // History
  const [localHistory, setLocalHistory] = useState<LocalProspectEntry[]>([]);
  const [expandedHistoryEntry, setExpandedHistoryEntry] = useState<string | null>(null);

  useEffect(() => {
    setLocalHistory(loadHistory());
  }, []);

  const setFilter = <K extends keyof ScanFilters>(key: K, value: ScanFilters[K]) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const addTitle = (title: string) => {
    const t = title.trim();
    if (t && !filters.jobTitles.includes(t)) {
      setFilter("jobTitles", [...filters.jobTitles, t]);
    }
    setTitleInput("");
  };

  const removeTitle = (title: string) => {
    setFilter(
      "jobTitles",
      filters.jobTitles.filter((t) => t !== title)
    );
  };

  // Scan mutation
  const scanMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/prospects/scan", {
        industry: filters.industry === "All Industries" ? undefined : filters.industry,
        geo: filters.geo !== "All US" ? filters.geo : undefined,
        employeeSize: filters.employeeSize || undefined,
        revenueRange: filters.revenueRange || undefined,
        productFocus: filters.productFocus || undefined,
        jobTitles: filters.jobTitles.length > 0 ? filters.jobTitles : undefined,
        techStack: filters.techStack || undefined,
        keywords: filters.keywords || undefined,
        excludeCompanies: excludedCompanies.slice(-60),
      });
      return res.json();
    },
    onSuccess: (data: Prospect[]) => {
      store.addProspects(data);
      setHasSearched(true);
      setCurrentPage(1);

      const newNames = data.map((p: any) => p.companyName).filter(Boolean);
      setExcludedCompanies((prev) => Array.from(new Set([...prev, ...newNames])));

      const totalContacts = data.reduce(
        (sum, p) => sum + JSON.parse(p.contacts || "[]").length,
        0
      );

      const entry: LocalProspectEntry = {
        id: `${Date.now()}-${Math.random()}`,
        filters: { ...filters },
        prospects: data,
        timestamp: Date.now(),
      };
      const updated = [entry, ...loadHistory()].slice(0, 20);
      saveHistory(updated);
      setLocalHistory(updated);

      toast({
        title: "Scan complete",
        description: `Found ${data.length} prospects with ${totalContacts} decision makers`,
      });
    },
    onError: (err: Error) =>
      toast({ title: "Scan failed", description: err.message, variant: "destructive" }),
  });

  const clearResults = () => {
    setExcludedCompanies([]);
    store.clearAll?.();
    setHasSearched(false);
    setCurrentPage(1);
  };

  const clearHistory = () => {
    saveHistory([]);
    setLocalHistory([]);
    toast({ title: "History cleared" });
  };

  // Stats
  const hot = prospects.filter((p) => p.score >= 75);
  const warm = prospects.filter((p) => p.score >= 50 && p.score < 75);
  const cold = prospects.filter((p) => p.score < 50);
  const totalContacts = prospects.reduce(
    (sum, p) => sum + JSON.parse(p.contacts || "[]").length,
    0
  );

  // Pagination
  const totalPages = Math.ceil(prospects.length / PAGE_SIZE);
  const paginated = prospects.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  return (
    <div className="space-y-6">
      {/* ── Page Header ─────────────────────────────────────────────────── */}
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-xl bg-[#696aac]/10 border border-[#696aac]/20 flex items-center justify-center shrink-0">
          <Radar className="w-6 h-6 text-[#a2a3e9]" />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-white/95">Prospect Engine</h1>
          <p className="text-sm text-white/40 mt-0.5">
            AI-powered prospect discovery · Apollo Pro + Hunter.io + PDL enrichment
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {hasSearched && (
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs gap-1.5 border-white/10 text-white/50 hover:text-white/80 hover:border-[#696aac]/40"
              onClick={clearResults}
              data-testid="button-new-search"
            >
              <Plus className="w-3.5 h-3.5" />
              New Search
            </Button>
          )}
          {hasSearched && prospects.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs gap-1.5 border-white/10 text-white/50 hover:text-white/80 hover:border-emerald-500/40"
              onClick={() => exportToCSV(prospects)}
              data-testid="button-export-csv"
            >
              <Download className="w-3.5 h-3.5" />
              Export CSV
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            className={`h-8 text-xs gap-1.5 border-white/10 transition-all ${
              showHistory
                ? "bg-[#696aac]/10 border-[#696aac]/40 text-[#a2a3e9]"
                : "text-white/50 hover:text-white/80 hover:border-[#696aac]/40"
            }`}
            onClick={() => setShowHistory(!showHistory)}
            data-testid="button-toggle-history"
          >
            <History className="w-3.5 h-3.5" />
            History
            {localHistory.length > 0 && (
              <span className="bg-[#696aac] text-white text-[9px] rounded-full px-1.5 py-0 leading-4 font-medium">
                {localHistory.length}
              </span>
            )}
          </Button>
        </div>
      </div>

      {showHistory ? (
        /* ── History View ─────────────────────────────────────────────── */
        <div className="space-y-3">
          {localHistory.length === 0 ? (
            <div className="rounded-xl border border-white/[0.08] bg-black/40 backdrop-blur-md">
              <div className="flex flex-col items-center justify-center py-20 text-white/20">
                <History className="w-10 h-10 mb-3 opacity-40" />
                <p className="text-sm">No prospect scans yet</p>
              </div>
            </div>
          ) : (
            <>
              {localHistory.map((entry) => (
                <div
                  key={entry.id}
                  className="rounded-xl border border-l-2 border-l-[#696aac] border-white/[0.08] bg-black/40 backdrop-blur-md overflow-hidden"
                >
                  <button
                    className="w-full text-left p-4 hover:bg-white/[0.02] transition-colors"
                    onClick={() =>
                      setExpandedHistoryEntry(
                        expandedHistoryEntry === entry.id ? null : entry.id
                      )
                    }
                    data-testid={`button-history-${entry.id}`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white/80 truncate">
                          {filterSummary(entry.filters)} — {entry.prospects.length}{" "}
                          prospects
                        </p>
                        <p className="text-xs text-white/30 mt-0.5">
                          {formatTimestamp(entry.timestamp)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/20 text-[10px]">
                          {entry.prospects.reduce(
                            (sum, p) => sum + JSON.parse(p.contacts || "[]").length,
                            0
                          )}{" "}
                          contacts
                        </Badge>
                        {expandedHistoryEntry === entry.id ? (
                          <ChevronUp className="w-4 h-4 text-white/30" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-white/30" />
                        )}
                      </div>
                    </div>
                    {expandedHistoryEntry !== entry.id && (
                      <div className="flex gap-1.5 mt-2 flex-wrap">
                        {entry.prospects.slice(0, 5).map((p, i) => (
                          <span
                            key={i}
                            className="text-[10px] text-white/30 border border-white/10 px-1.5 py-0.5 rounded"
                          >
                            {p.companyName}
                          </span>
                        ))}
                        {entry.prospects.length > 5 && (
                          <span className="text-[10px] text-white/20">
                            +{entry.prospects.length - 5} more
                          </span>
                        )}
                      </div>
                    )}
                  </button>

                  {expandedHistoryEntry === entry.id && (
                    <div className="px-4 pb-4 space-y-3 border-t border-white/[0.06] pt-3">
                      {/* Stats */}
                      <div className="grid grid-cols-4 gap-2">
                        {(() => {
                          const h = entry.prospects.filter((p) => p.score >= 75).length;
                          const w = entry.prospects.filter(
                            (p) => p.score >= 50 && p.score < 75
                          ).length;
                          const c = entry.prospects.filter((p) => p.score < 50).length;
                          const tc = entry.prospects.reduce(
                            (sum, p) => sum + JSON.parse(p.contacts || "[]").length,
                            0
                          );
                          return (
                            <>
                              {[
                                { label: "Hot", count: h, color: "text-rose-400 border-l-rose-500" },
                                { label: "Warm", count: w, color: "text-amber-400 border-l-amber-500" },
                                { label: "Cold", count: c, color: "text-[#a2a3e9] border-l-[#696aac]" },
                                { label: "Contacts", count: tc, color: "text-emerald-400 border-l-emerald-500" },
                              ].map((stat) => (
                                <div
                                  key={stat.label}
                                  className={`rounded-lg border border-l-2 ${stat.color} border-white/[0.08] bg-white/[0.02] p-2 text-center`}
                                >
                                  <p className={`text-lg font-bold ${stat.color.split(" ")[0]}`}>
                                    {stat.count}
                                  </p>
                                  <p className="text-[9px] text-white/30 uppercase tracking-wider">
                                    {stat.label}
                                  </p>
                                </div>
                              ))}
                            </>
                          );
                        })()}
                      </div>

                      {/* Re-load button */}
                      <Button
                        size="sm"
                        className="w-full h-8 text-xs gap-1.5 bg-[#696aac] hover:bg-[#7b7cb8] border-0"
                        onClick={() => {
                          store.addProspects(entry.prospects);
                          setHasSearched(true);
                          setCurrentPage(1);
                          setShowHistory(false);
                          toast({ title: "Search loaded", description: `Loaded ${entry.prospects.length} prospects from history` });
                        }}
                        data-testid={`button-reload-history-${entry.id}`}
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        Load These Results
                      </Button>

                      {/* Prospect list */}
                      <div className="space-y-2">
                        {entry.prospects.map((p, i) => (
                          <ProspectCard key={i} prospect={p} />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}

              <div className="flex justify-end pt-1">
                <button
                  onClick={clearHistory}
                  className="flex items-center gap-1 text-xs text-red-400/60 hover:text-red-400 transition-colors"
                  data-testid="button-clear-history"
                >
                  <Trash2 className="w-3 h-3" />
                  Clear History
                </button>
              </div>
            </>
          )}
        </div>
      ) : (
        <>
          {/* ── Filter Panel ──────────────────────────────────────────────── */}
          <div className="rounded-xl border border-white/[0.08] bg-black/40 backdrop-blur-md overflow-hidden">
            {/* Filter header */}
            <div className="flex items-center gap-2 px-5 py-3 border-b border-white/[0.06]">
              <SlidersHorizontal className="w-4 h-4 text-[#a2a3e9]" />
              <span className="text-sm font-medium text-white/80">Search Filters</span>
              {(filters.industry !== "All Industries" ||
                filters.geo !== "All US" ||
                filters.employeeSize ||
                filters.revenueRange ||
                filters.productFocus ||
                filters.jobTitles.length > 0 ||
                filters.techStack ||
                filters.keywords) && (
                <button
                  onClick={() =>
                    setFilters({
                      industry: "All Industries",
                      geo: "All US",
                      employeeSize: "",
                      revenueRange: "",
                      productFocus: "",
                      jobTitles: [],
                      techStack: "",
                      keywords: "",
                    })
                  }
                  className="ml-auto text-[10px] text-white/30 hover:text-white/60 flex items-center gap-1 transition-colors"
                  data-testid="button-reset-filters"
                >
                  <X className="w-3 h-3" />
                  Reset
                </button>
              )}
            </div>

            <div className="p-5 space-y-4">
              {/* Row 1: Industry + Geography */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="flex items-center gap-1.5 text-[10px] font-semibold text-white/40 uppercase tracking-widest">
                    <Building2 className="w-3 h-3" />
                    Industry
                  </label>
                  <Select
                    value={filters.industry}
                    onValueChange={(v) => setFilter("industry", v)}
                  >
                    <SelectTrigger
                      className="h-9 bg-white/[0.03] border-white/10 text-white/80 text-sm"
                      data-testid="select-industry"
                    >
                      <SelectValue placeholder="Select industry" />
                    </SelectTrigger>
                    <SelectContent className="bg-[#0a0a14] border-white/10">
                      {INDUSTRIES.map((i) => (
                        <SelectItem key={i} value={i}>
                          {i}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <label className="flex items-center gap-1.5 text-[10px] font-semibold text-white/40 uppercase tracking-widest">
                    <MapPin className="w-3 h-3" />
                    Geography
                  </label>
                  <Select
                    value={filters.geo}
                    onValueChange={(v) => setFilter("geo", v)}
                  >
                    <SelectTrigger
                      className="h-9 bg-white/[0.03] border-white/10 text-white/80 text-sm"
                      data-testid="select-geography"
                    >
                      <SelectValue placeholder="Geography" />
                    </SelectTrigger>
                    <SelectContent className="bg-[#0a0a14] border-white/10">
                      {GEOGRAPHIES.map((g) => (
                        <SelectItem key={g.value} value={g.value}>
                          {g.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Row 2: Employee Size + Revenue Range */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="flex items-center gap-1.5 text-[10px] font-semibold text-white/40 uppercase tracking-widest">
                    <Users className="w-3 h-3" />
                    Company Size (Employees)
                  </label>
                  <Select
                    value={filters.employeeSize}
                    onValueChange={(v) => setFilter("employeeSize", v)}
                  >
                    <SelectTrigger
                      className="h-9 bg-white/[0.03] border-white/10 text-white/80 text-sm"
                      data-testid="select-employee-size"
                    >
                      <SelectValue placeholder="Any size" />
                    </SelectTrigger>
                    <SelectContent className="bg-[#0a0a14] border-white/10">
                      {EMPLOYEE_SIZES.map((s) => (
                        <SelectItem key={s.value} value={s.value || "any"}>
                          {s.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <label className="flex items-center gap-1.5 text-[10px] font-semibold text-white/40 uppercase tracking-widest">
                    <DollarSign className="w-3 h-3" />
                    Revenue Range
                  </label>
                  <Select
                    value={filters.revenueRange}
                    onValueChange={(v) => setFilter("revenueRange", v)}
                  >
                    <SelectTrigger
                      className="h-9 bg-white/[0.03] border-white/10 text-white/80 text-sm"
                      data-testid="select-revenue-range"
                    >
                      <SelectValue placeholder="Any revenue" />
                    </SelectTrigger>
                    <SelectContent className="bg-[#0a0a14] border-white/10">
                      {REVENUE_RANGES.map((r) => (
                        <SelectItem key={r.value} value={r.value || "any"}>
                          {r.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Row 3: Product to Pitch */}
              <div className="space-y-1.5">
                <label className="flex items-center gap-1.5 text-[10px] font-semibold text-white/40 uppercase tracking-widest">
                  <Briefcase className="w-3 h-3" />
                  Product to Pitch
                </label>
                <input
                  type="text"
                  value={filters.productFocus}
                  onChange={(e) => setFilter("productFocus", e.target.value)}
                  placeholder="e.g. Akamai, Five9, TierPoint, Antimatter AI, ATOM Enterprise..."
                  className="flex h-9 w-full rounded-md border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white/80 placeholder:text-white/20 focus:outline-none focus:ring-1 focus:ring-[#696aac]/50 focus:border-[#696aac]/50 transition-all"
                  data-testid="input-product-focus"
                />
              </div>

              {/* Row 4: Job Titles */}
              <div className="space-y-1.5">
                <label className="flex items-center gap-1.5 text-[10px] font-semibold text-white/40 uppercase tracking-widest">
                  <User className="w-3 h-3" />
                  Job Titles to Target
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      value={titleInput}
                      onChange={(e) => setTitleInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === ",") {
                          e.preventDefault();
                          addTitle(titleInput);
                        }
                      }}
                      placeholder="Type a title and press Enter, or pick below..."
                      className="flex h-9 w-full rounded-md border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white/80 placeholder:text-white/20 focus:outline-none focus:ring-1 focus:ring-[#696aac]/50 focus:border-[#696aac]/50 transition-all"
                      data-testid="input-job-title"
                    />
                  </div>
                </div>

                {/* Quick-add title chips */}
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {JOB_TITLES.filter((t) => !filters.jobTitles.includes(t)).map(
                    (title) => (
                      <button
                        key={title}
                        onClick={() => addTitle(title)}
                        className="text-[10px] px-2 py-0.5 rounded border border-white/10 text-white/30 hover:text-[#a2a3e9] hover:border-[#696aac]/40 hover:bg-[#696aac]/5 transition-all"
                        data-testid={`button-add-title-${title}`}
                      >
                        + {title}
                      </button>
                    )
                  )}
                </div>

                {/* Selected titles */}
                {filters.jobTitles.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {filters.jobTitles.map((t) => (
                      <TitleBadge key={t} title={t} onRemove={() => removeTitle(t)} />
                    ))}
                  </div>
                )}
              </div>

              {/* Row 5: Tech Stack + Keywords */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="flex items-center gap-1.5 text-[10px] font-semibold text-white/40 uppercase tracking-widest">
                    <Cpu className="w-3 h-3" />
                    Tech Stack Filter
                  </label>
                  <input
                    type="text"
                    value={filters.techStack}
                    onChange={(e) => setFilter("techStack", e.target.value)}
                    placeholder="e.g. companies using Salesforce, AWS, SAP..."
                    className="flex h-9 w-full rounded-md border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white/80 placeholder:text-white/20 focus:outline-none focus:ring-1 focus:ring-[#696aac]/50 focus:border-[#696aac]/50 transition-all"
                    data-testid="input-tech-stack"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="flex items-center gap-1.5 text-[10px] font-semibold text-white/40 uppercase tracking-widest">
                    <Tag className="w-3 h-3" />
                    Keywords
                  </label>
                  <input
                    type="text"
                    value={filters.keywords}
                    onChange={(e) => setFilter("keywords", e.target.value)}
                    placeholder="e.g. digital transformation, AI adoption, IPO..."
                    className="flex h-9 w-full rounded-md border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white/80 placeholder:text-white/20 focus:outline-none focus:ring-1 focus:ring-[#696aac]/50 focus:border-[#696aac]/50 transition-all"
                    data-testid="input-keywords"
                  />
                </div>
              </div>

              {/* Action row */}
              <div className="flex items-center gap-3 pt-1">
                <Button
                  onClick={() => scanMutation.mutate()}
                  disabled={scanMutation.isPending}
                  className="flex-1 sm:flex-none sm:w-44 h-10 bg-[#696aac] hover:bg-[#7b7cb8] border-0 font-medium transition-colors shadow-lg shadow-[#696aac]/20"
                  data-testid="button-scan-prospects"
                >
                  {scanMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Scanning...
                    </>
                  ) : (
                    <>
                      <Radar className="w-4 h-4 mr-2" />
                      Scan + Enrich
                    </>
                  )}
                </Button>

                {excludedCompanies.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-10 text-xs border-white/10 text-white/40 hover:text-white/70 hover:border-white/20"
                    onClick={clearResults}
                    data-testid="button-reset-exclusions"
                  >
                    ↺ Reset ({excludedCompanies.length} excluded)
                  </Button>
                )}
              </div>

              {/* Scanning progress indicator */}
              {scanMutation.isPending && (
                <div className="mt-1 p-3 rounded-lg border border-[#696aac]/20 bg-[#696aac]/5">
                  <div className="flex items-center gap-2 text-sm text-[#a2a3e9]">
                    <div className="flex gap-0.5">
                      {[0, 1, 2].map((i) => (
                        <div
                          key={i}
                          className="w-1.5 h-1.5 rounded-full bg-[#696aac] animate-bounce"
                          style={{ animationDelay: `${i * 0.15}s` }}
                        />
                      ))}
                    </div>
                    <span className="font-medium">
                      ATOM scanning prospects via Apollo Pro · Hunter.io · PDL enrichment...
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── Results Stats ─────────────────────────────────────────────── */}
          {hasSearched && prospects.length > 0 && (
            <div className="grid grid-cols-4 gap-3">
              {[
                { label: "Hot (75+)", count: hot.length, color: "text-rose-400", border: "border-l-rose-500" },
                { label: "Warm (50-74)", count: warm.length, color: "text-amber-400", border: "border-l-amber-500" },
                { label: "Cold (<50)", count: cold.length, color: "text-[#a2a3e9]", border: "border-l-[#696aac]" },
                { label: "Contacts", count: totalContacts, color: "text-emerald-400", border: "border-l-emerald-500" },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className={`rounded-xl border border-l-2 ${stat.border} border-white/[0.08] bg-black/40 backdrop-blur-md p-4 text-center`}
                  data-testid={`stat-${stat.label.toLowerCase().replace(/\s/g, "-")}`}
                >
                  <p className={`text-2xl font-bold ${stat.color}`}>{stat.count}</p>
                  <p className="text-[10px] text-white/30 uppercase tracking-wider mt-0.5">
                    {stat.label}
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* ── Loading Skeletons ─────────────────────────────────────────── */}
          {scanMutation.isPending && <LoadingSkeleton />}

          {/* ── Results List ─────────────────────────────────────────────── */}
          {!scanMutation.isPending && hasSearched && prospects.length > 0 && (
            <>
              <div className="space-y-3">
                {paginated.map((p) => (
                  <ProspectCard key={p.id} prospect={p} />
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between pt-2">
                  <p className="text-xs text-white/30">
                    Showing {(currentPage - 1) * PAGE_SIZE + 1}–
                    {Math.min(currentPage * PAGE_SIZE, prospects.length)} of{" "}
                    {prospects.length} prospects
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 w-8 p-0 border-white/10 text-white/40 hover:text-white/80 hover:border-white/20"
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      data-testid="button-page-prev"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    {[...Array(totalPages)].map((_, i) => (
                      <button
                        key={i}
                        onClick={() => setCurrentPage(i + 1)}
                        className={`w-8 h-8 text-xs rounded-md border transition-all ${
                          currentPage === i + 1
                            ? "bg-[#696aac]/20 border-[#696aac]/40 text-[#a2a3e9]"
                            : "border-white/10 text-white/30 hover:text-white/60 hover:border-white/20"
                        }`}
                        data-testid={`button-page-${i + 1}`}
                      >
                        {i + 1}
                      </button>
                    ))}
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 w-8 p-0 border-white/10 text-white/40 hover:text-white/80 hover:border-white/20"
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      data-testid="button-page-next"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}

              {/* Load more from API */}
              <div className="flex justify-center pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 text-sm gap-2 border-[#696aac]/30 text-[#a2a3e9] hover:bg-[#696aac]/10 hover:border-[#696aac]/50"
                  onClick={() => scanMutation.mutate()}
                  disabled={scanMutation.isPending}
                  data-testid="button-load-more"
                >
                  {scanMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Search className="w-4 h-4" />
                  )}
                  Load More Prospects
                </Button>
              </div>
            </>
          )}

          {/* ── Empty state ───────────────────────────────────────────────── */}
          {!scanMutation.isPending && (!hasSearched || prospects.length === 0) && (
            <div className="rounded-xl border border-white/[0.08] bg-black/40 backdrop-blur-md">
              <div className="flex flex-col items-center justify-center py-24 text-white/20">
                <div className="w-16 h-16 rounded-2xl bg-[#696aac]/10 border border-[#696aac]/20 flex items-center justify-center mb-4">
                  <Radar className="w-8 h-8 text-[#696aac]/60" />
                </div>
                <p className="text-sm text-white/30 mb-1">No prospects yet</p>
                <p className="text-xs text-white/20">
                  Configure your filters above and hit Scan + Enrich
                </p>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
