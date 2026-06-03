import { useState, useRef, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import {
  Swords, TrendingUp, MessageSquareWarning, Shield, Radar,
  PhoneCall, ListChecks, Brain, Search, ArrowRight, FileSearch,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface PaletteItem {
  id: string;
  label: string;
  href: string;
  icon: React.ElementType;
  keywords: string;
}

const NAV_ITEMS: PaletteItem[] = [
  { id: "war-room", label: "ΔTOM War Room", href: "/war-room", icon: Swords, keywords: "war room deals pipeline" },
  { id: "pitch", label: "ΔTOM Pitch", href: "/pitch", icon: TrendingUp, keywords: "pitch home dashboard" },
  { id: "objections", label: "ΔTOM Objection Handler", href: "/objections", icon: MessageSquareWarning, keywords: "objection handler respond" },
  { id: "market", label: "ΔTOM Market Intent", href: "/market", icon: Shield, keywords: "market intent signals buying" },
  { id: "prospects", label: "ΔTOM Prospect", href: "/prospects", icon: Radar, keywords: "prospect engine scan company" },
  { id: "leadgen", label: "ΔTOM Lead Gen", href: "/atom-leadgen", icon: PhoneCall, keywords: "lead gen dialer call phone" },
  { id: "campaigns", label: "ΔTOM Campaigns", href: "/campaigns", icon: ListChecks, keywords: "campaign bulk import csv" },
  { id: "warbook", label: "ΔTOM WarBook", href: "/company-intelligence", icon: Brain, keywords: "warbook company intelligence research" },
  { id: "researcher", label: "ΔTOM Researcher Pro", href: "/researcher", icon: FileSearch, keywords: "researcher sonar deep research dossier perplexity vibranium account intelligence" },
];

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  navigate: (path: string) => void;
}

export function CommandPalette({ open, onOpenChange, navigate }: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = query.trim()
    ? NAV_ITEMS.filter((item) => {
        const q = query.toLowerCase();
        return item.label.toLowerCase().includes(q) || item.keywords.includes(q);
      })
    : NAV_ITEMS;

  const select = useCallback(
    (item: PaletteItem) => {
      onOpenChange(false);
      navigate(item.href);
    },
    [onOpenChange, navigate],
  );

  useEffect(() => {
    if (open) {
      setQuery("");
      setSelectedIndex(0);
      // Focus input on next tick after dialog opens
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => (i + 1) % filtered.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => (i - 1 + filtered.length) % filtered.length);
    } else if (e.key === "Enter" && filtered[selectedIndex]) {
      e.preventDefault();
      select(filtered[selectedIndex]);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-[480px] p-0 gap-0 bg-[#0c0c14] border-[#2a2a4a] overflow-hidden"
        onKeyDown={handleKeyDown}
      >
        <VisuallyHidden><DialogTitle>Command Palette</DialogTitle></VisuallyHidden>

        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-white/[0.06]">
          <Search size={16} className="text-white/30 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search pages..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 bg-transparent text-sm text-[#f6f6fd] placeholder:text-white/25 outline-none"
            autoComplete="off"
          />
          <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 text-[10px] font-mono text-white/25 bg-white/[0.04] border border-white/[0.06] rounded">
            esc
          </kbd>
        </div>

        {/* Results */}
        <AnimatePresence mode="wait">
          <motion.div
            key={query}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.12 }}
            className="max-h-[320px] overflow-y-auto py-1"
          >
            {filtered.length === 0 ? (
              <div className="py-8 text-center text-sm text-white/25">No results</div>
            ) : (
              filtered.map((item, i) => {
                const Icon = item.icon;
                const isActive = i === selectedIndex;
                return (
                  <button
                    key={item.id}
                    onClick={() => select(item)}
                    onMouseEnter={() => setSelectedIndex(i)}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors ${
                      isActive ? "bg-white/[0.06] text-[#f6f6fd]" : "text-white/50 hover:bg-white/[0.03]"
                    }`}
                  >
                    <Icon size={16} className={isActive ? "text-[var(--color-primary)]" : "text-white/25"} />
                    <span className="flex-1">{item.label}</span>
                    {isActive && <ArrowRight size={14} className="text-white/20" />}
                  </button>
                );
              })
            )}
          </motion.div>
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}
