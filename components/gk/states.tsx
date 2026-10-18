"use client";
import { AlertTriangle, ExternalLink, Info, RotateCcw } from "lucide-react";
import type { GkLang, SourceInfo } from "@/lib/gk/types";
import { cn } from "@/lib/utils";
import { Button } from "../ui/button";
import { formatDate, t } from "./i18n";
import type { SourceState } from "./use-source";

export function Notice({ tone = "info", title, children, className }: { tone?: "info" | "warning"; title?: string; children: React.ReactNode; className?: string }) {
  const Icon = tone === "warning" ? AlertTriangle : Info;
  return (
    <div
      className={cn(
        "flex gap-3 rounded-lg border px-4 py-3 text-sm",
        tone === "warning" ? "border-warning/40 bg-warning-soft text-foreground" : "bg-muted/60",
        className,
      )}
    >
      <Icon className={cn("mt-0.5 size-4 shrink-0", tone === "warning" ? "text-accent-foreground dark:text-warning" : "text-primary")} aria-hidden />
      <div className="min-w-0 space-y-1">
        {title && <p className="font-semibold">{title}</p>}
        <div className="text-muted-foreground [&_a]:font-semibold [&_a]:text-primary [&_a]:underline-offset-2 hover:[&_a]:underline">{children}</div>
      </div>
    </div>
  );
}

export function ErrorState({ state, lang, onRetry }: { state: Extract<SourceState<unknown>, { status: "error" }>; lang: GkLang; onRetry: () => void }) {
  if (state.code === "unauthorized") return null;
  const translated = state.code === "network" || state.code === "rate_limited";
  const message = state.code === "network" ? t(lang, "networkError") : state.code === "rate_limited" ? t(lang, "rateLimited") : state.message;
  return (
    <div role="alert" className="flex flex-col items-start gap-3 rounded-lg border border-danger/30 bg-danger-soft px-4 py-4 text-sm sm:flex-row sm:items-center sm:justify-between">
      <p className="flex items-start gap-2 font-medium text-danger">
        <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
        {/* Messages from the server describe the source failure in English; mark them as such. */}
        <span lang={translated ? lang : "en"}>{message}</span>
      </p>
      <Button variant="outline" size="sm" onClick={onRetry} className="shrink-0">
        <RotateCcw /> {t(lang, "retryLoad")}
      </Button>
    </div>
  );
}

export function SourceFooter({ source, fetchedAt, stale, lang }: { source: SourceInfo; fetchedAt: string; stale: boolean; lang: GkLang }) {
  return (
    <div className="space-y-2">
      {stale && (
        <Notice tone="warning">
          <p>{t(lang, "staleNotice", { date: formatDate(fetchedAt, lang) })}</p>
        </Notice>
      )}
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <a href={source.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-semibold hover:text-foreground hover:underline">
          {t(lang, "sourceLine", { name: source.name, license: source.license })}
          <ExternalLink className="size-3" aria-hidden />
        </a>
        <span>{t(lang, "fetchedAt", { date: formatDate(fetchedAt, lang) })}</span>
      </p>
    </div>
  );
}

export function CardSkeleton({ rows = 3, label }: { rows?: number; label: string }) {
  return (
    <div aria-busy="true" className="grid gap-3">
      <p role="status" className="sr-only">
        {label}
      </p>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="animate-pulse rounded-lg border bg-card p-4 sm:p-5">
          <div className="mb-3 h-4 w-28 rounded-full bg-muted" />
          <div className="mb-2 h-4 w-full rounded bg-muted" />
          <div className="h-4 w-2/3 rounded bg-muted" />
        </div>
      ))}
    </div>
  );
}

/** Two-way toggle styled like the rest of the app's segmented controls. */
export function Segmented<T extends string | number>({
  label,
  value,
  onChange,
  options,
  className,
}: {
  label: string;
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string; lang?: string }[];
  className?: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className={cn("inline-flex rounded-md border bg-muted p-1", className)}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          lang={o.lang}
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "h-9 flex-1 whitespace-nowrap rounded-[calc(var(--radius)-6px)] px-3 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            value === o.value && "bg-card text-foreground shadow-sm",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
