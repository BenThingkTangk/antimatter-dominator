import { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { DtomLogo } from "@nirmata/atom-design-system/react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Upload, FileSpreadsheet, ArrowRight, ArrowLeft, Loader2 } from "lucide-react";
import { useSessionContext } from "@/auth/AuthGate";
import { useToast } from "@/hooks/use-toast";

const TOTAL_SCREENS = 4;

function ProgressDots({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-2 justify-center mb-6">
      {Array.from({ length: TOTAL_SCREENS }).map((_, i) => (
        <div
          key={i}
          className="w-2 h-2 rounded-full transition-all duration-300"
          style={{
            background: i <= current ? "var(--color-primary)" : "rgba(255,255,255,0.15)",
            boxShadow: i <= current ? "0 0 6px var(--color-primary-glow)" : "none",
          }}
        />
      ))}
    </div>
  );
}

const slideVariants = {
  enter: (dir: number) => ({ x: dir > 0 ? 80 : -80, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir > 0 ? -80 : 80, opacity: 0 }),
};

interface OnboardingWizardProps {
  onComplete: () => void;
}

export function OnboardingWizard({ onComplete }: OnboardingWizardProps) {
  const { user, refresh } = useSessionContext();
  const { toast } = useToast();

  const [screen, setScreen] = useState(0);
  const [direction, setDirection] = useState(1);
  const [fullName, setFullName] = useState(user?.fullName || "");
  const [productSeed, setProductSeed] = useState("");
  const [icpSeed, setIcpSeed] = useState("");
  const [prospectFile, setProspectFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const next = useCallback(() => {
    setDirection(1);
    setScreen((s) => Math.min(s + 1, TOTAL_SCREENS - 1));
  }, []);

  const back = useCallback(() => {
    setDirection(-1);
    setScreen((s) => Math.max(s - 1, 0));
  }, []);

  const handleSubmit = async (source: "demo" | "upload") => {
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/me/onboarding-complete", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName,
          productSeed,
          icpSeed,
          prospectSource: source,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(err.error || "Failed to complete onboarding");
      }
      refresh();
      onComplete();
    } catch (e: any) {
      toast({ title: "Onboarding error", description: e.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file && (file.name.endsWith(".csv") || file.name.endsWith(".xlsx"))) {
      setProspectFile(file);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setProspectFile(file);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(8,8,12,0.85)", backdropFilter: "blur(12px)" }}>
      <div
        className="relative w-full max-w-[540px] mx-4 p-8 rounded-2xl overflow-hidden"
        style={{
          background: "linear-gradient(180deg, rgba(14,14,22,0.98) 0%, rgba(10,10,16,0.99) 100%)",
          border: "1px solid var(--color-border)",
          boxShadow: "0 0 60px rgba(0,200,200,0.06)",
        }}
      >
        {/* Logo */}
        <div className="flex justify-center mb-4">
          <DtomLogo size="sm" showIcon={false} showWordmark={true} ariaLabel="ΔTOM" />
        </div>

        <ProgressDots current={screen} />

        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={screen}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.2, ease: "easeOut" }}
          >
            {screen === 0 && (
              <div className="space-y-5">
                <h2
                  className="text-[28px] font-[800] text-center"
                  style={{ fontFamily: "var(--font-display)", color: "var(--color-text)" }}
                >
                  What should we call you?
                </h2>
                <Input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Your name"
                  className="text-center text-lg bg-white/[0.04] border-white/[0.08]"
                  autoFocus
                />
                <p className="text-[13px] text-center text-white/40">
                  We'll use this on every call ΔTOM makes for you.
                </p>
              </div>
            )}

            {screen === 1 && (
              <div className="space-y-5">
                <h2
                  className="text-[28px] font-[800] text-center"
                  style={{ fontFamily: "var(--font-display)", color: "var(--color-text)" }}
                >
                  What do you sell?
                </h2>
                <Textarea
                  value={productSeed}
                  onChange={(e) => setProductSeed(e.target.value)}
                  rows={3}
                  maxLength={300}
                  placeholder='e.g. "We sell observability software to mid-market SaaS engineering teams (50-500 engineers)."'
                  className="bg-white/[0.04] border-white/[0.08] resize-none"
                />
                <p className="text-[13px] text-center text-white/40">
                  One or two sentences. ΔTOM uses this to write every opener.
                </p>
              </div>
            )}

            {screen === 2 && (
              <div className="space-y-5">
                <h2
                  className="text-[28px] font-[800] text-center"
                  style={{ fontFamily: "var(--font-display)", color: "var(--color-text)" }}
                >
                  Describe your ideal customer
                </h2>
                <Textarea
                  value={icpSeed}
                  onChange={(e) => setIcpSeed(e.target.value)}
                  rows={3}
                  maxLength={300}
                  placeholder='e.g. "VP of Engineering or Head of Platform at a Series B–D SaaS company with 50–500 engineers; recently raised; using Datadog or New Relic."'
                  className="bg-white/[0.04] border-white/[0.08] resize-none"
                />
                <p className="text-[13px] text-center text-white/40">
                  Title, company size, industry, signals.
                </p>
              </div>
            )}

            {screen === 3 && (
              <div className="space-y-5">
                <h2
                  className="text-[28px] font-[800] text-center"
                  style={{ fontFamily: "var(--font-display)", color: "var(--color-text)" }}
                >
                  Upload your first prospect list — or try our demo
                </h2>

                {/* Dropzone */}
                <div
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className="flex flex-col items-center justify-center gap-3 py-8 rounded-xl cursor-pointer transition-all"
                  style={{
                    border: `2px dashed ${dragOver ? "var(--color-primary)" : "rgba(255,255,255,0.1)"}`,
                    background: dragOver ? "rgba(0,200,200,0.04)" : "rgba(255,255,255,0.02)",
                  }}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,.xlsx"
                    className="hidden"
                    onChange={handleFileSelect}
                  />
                  {prospectFile ? (
                    <>
                      <FileSpreadsheet size={28} className="text-[var(--color-primary)]" />
                      <span className="text-sm text-white/70 font-medium">{prospectFile.name}</span>
                      <span className="text-[11px] text-white/30">Click to replace</span>
                    </>
                  ) : (
                    <>
                      <Upload size={28} className="text-white/20" />
                      <span className="text-sm text-white/40">Drop a .csv or .xlsx here</span>
                      <span className="text-[11px] text-white/25">or click to browse</span>
                    </>
                  )}
                </div>

                {/* Demo list button */}
                <Button
                  variant="outline"
                  className="w-full border-white/[0.08] text-white/60 hover:bg-white/[0.04]"
                  disabled={submitting}
                  onClick={() => handleSubmit("demo")}
                >
                  {submitting ? <Loader2 size={16} className="animate-spin mr-2" /> : null}
                  Use demo list (50 prospects)
                </Button>

                <p className="text-[13px] text-center text-white/40">
                  ΔTOM will enrich and qualify before any dial fires.
                </p>
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Navigation buttons */}
        <div className="flex items-center justify-between mt-8">
          {screen > 0 ? (
            <button
              onClick={back}
              className="flex items-center gap-1 text-sm text-white/40 hover:text-white/70 transition-colors"
            >
              <ArrowLeft size={14} /> Back
            </button>
          ) : (
            <div />
          )}

          {screen < 3 && (
            <Button
              onClick={next}
              disabled={
                (screen === 0 && !fullName.trim()) ||
                (screen === 1 && !productSeed.trim()) ||
                (screen === 2 && !icpSeed.trim())
              }
              className="px-6 rounded-full"
              style={{
                background: "linear-gradient(96deg, var(--color-primary), var(--color-primary-2))",
                color: "var(--color-text-inverse)",
              }}
            >
              {screen === 0 ? "Looks right" : "Next"} <ArrowRight size={14} className="ml-1" />
            </Button>
          )}

          {screen === 3 && prospectFile && (
            <Button
              onClick={() => handleSubmit("upload")}
              disabled={submitting}
              className="px-6 rounded-full"
              style={{
                background: "linear-gradient(96deg, var(--color-primary), var(--color-primary-2))",
                color: "var(--color-text-inverse)",
              }}
            >
              {submitting ? <Loader2 size={16} className="animate-spin mr-1" /> : null}
              Let's go <ArrowRight size={14} className="ml-1" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
