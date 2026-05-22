import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ErrorStateProps {
  message?: string;
  onRetry?: () => void;
  className?: string;
}

export function ErrorState({ message, onRetry, className }: ErrorStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center py-20 gap-4 text-center ${className ?? ""}`}>
      <div
        className="w-14 h-14 rounded-full flex items-center justify-center"
        style={{
          background: "color-mix(in oklab, var(--color-error, #ef4444) 10%, transparent)",
          border: "1.5px solid color-mix(in oklab, var(--color-error, #ef4444) 15%, transparent)",
        }}
      >
        <AlertTriangle size={26} className="text-[var(--color-error,#ef4444)] opacity-70" />
      </div>
      <div className="space-y-1.5 max-w-sm">
        <p className="text-[15px] font-semibold text-[#f6f6fd]">Something went wrong</p>
        <p className="text-[13px] text-white/40 leading-relaxed">
          {message || "Failed to load data. Please try again."}
        </p>
      </div>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry} className="mt-1">
          Try again
        </Button>
      )}
    </div>
  );
}
