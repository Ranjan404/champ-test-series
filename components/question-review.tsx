"use client";
import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { ReviewItem } from "@/lib/report";
import { formatMarks } from "@/lib/scoring";
import { OptionList } from "./option-list";
import { Badge } from "./ui/badge";
import { cn } from "@/lib/utils";

const FILTERS = [
  { key: "all", label: "All" },
  { key: "incorrect", label: "Incorrect" },
  { key: "not_attempted", label: "Not attempted" },
  { key: "correct", label: "Correct" },
] as const;

export function QuestionReview({ items }: { items: ReviewItem[] }) {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["key"]>("all");
  const shown = items.filter((i) => filter === "all" || i.outcome === filter);
  return (
    <div>
      <div className="mb-4 flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Filter questions">
        {FILTERS.map((f) => {
          const count = f.key === "all" ? items.length : items.filter((i) => i.outcome === f.key).length;
          return (
            <button
              key={f.key}
              role="tab"
              aria-selected={filter === f.key}
              onClick={() => setFilter(f.key)}
              className={cn(
                "h-9 shrink-0 rounded-full border px-3.5 text-sm font-semibold",
                filter === f.key ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-muted",
              )}
            >
              {f.label} <span className="opacity-70">{count}</span>
            </button>
          );
        })}
      </div>
      <div className="grid gap-2">
        {shown.map((i) => (
          <details key={i.id} className="group rounded-lg border bg-card open:shadow-sm">
            <summary className="flex cursor-pointer list-none items-start gap-3 p-3 sm:p-4 [&::-webkit-details-marker]:hidden">
              <span
                className={cn(
                  "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full font-mono text-xs font-bold",
                  i.outcome === "correct" && "bg-success-soft text-success",
                  i.outcome === "incorrect" && "bg-danger-soft text-danger",
                  i.outcome === "not_attempted" && "bg-muted text-muted-foreground",
                )}
              >
                {i.index}
              </span>
              <span className="line-clamp-2 min-w-0 flex-1 text-sm font-medium group-open:line-clamp-none">{i.question}</span>
              <span className="flex shrink-0 items-center gap-2">
                <span className="hidden font-mono text-xs font-bold text-muted-foreground min-[420px]:inline">{formatMarks(i.marks)}</span>
                <ChevronDown className="size-4 text-muted-foreground transition-transform group-open:rotate-180" />
              </span>
            </summary>
            <div className="border-t p-3 sm:p-4">
              <div className="mb-3 flex flex-wrap gap-1.5">
                <Badge variant="muted">{i.topic}</Badge>
                <Badge variant="muted">{i.difficulty}</Badge>
                <Badge variant="muted">{i.type === "multiple" ? "Multiple select" : "Single select"}</Badge>
              </div>
              <OptionList question={i} value={i.answer} locked correct={i.correct} />
              <p className="mt-3 rounded-md bg-muted p-3 text-sm leading-relaxed">
                <span className="font-semibold">Explanation: </span>
                {i.explanation}
              </p>
            </div>
          </details>
        ))}
        {!shown.length && <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">No questions in this group.</p>}
      </div>
    </div>
  );
}
