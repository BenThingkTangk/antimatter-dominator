import type { LucideIcon } from "lucide-react";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  className?: string;
}

export function EmptyState({ icon: Icon, title, description, className }: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center py-20 gap-4 text-center ${className ?? ""}`}>
      <div
        className="w-14 h-14 rounded-full flex items-center justify-center"
        style={{
          background: "color-mix(in oklab, var(--color-primary) 10%, transparent)",
          border: "1.5px solid color-mix(in oklab, var(--color-primary) 15%, transparent)",
        }}
      >
        <Icon size={26} className="text-[var(--color-primary)] opacity-60" />
      </div>
      <div className="space-y-1.5 max-w-sm">
        <p className="text-[15px] font-semibold text-[#f6f6fd]">{title}</p>
        <p className="text-[13px] text-white/40 leading-relaxed">{description}</p>
      </div>
    </div>
  );
}
