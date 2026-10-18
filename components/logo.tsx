import { cn } from "@/lib/utils";

export function Logo({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2 font-extrabold tracking-tight", className)}>
      <svg viewBox="0 0 32 32" className="size-8 shrink-0" aria-hidden>
        <rect width="32" height="32" rx="8" className="fill-primary" />
        <path d="M9 17l4.5 4.5L23 11" fill="none" stroke="var(--accent)" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {!compact && (
        <span className="leading-none">
          Champ<span className="text-muted-foreground font-semibold"> Test Series</span>
        </span>
      )}
    </span>
  );
}
