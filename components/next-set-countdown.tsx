"use client";
import { useEffect, useState } from "react";
import { Hourglass } from "lucide-react";

/** Counts down to midnight IST, when the next daily set appears, then reloads the page to show it. */
export function NextSetCountdown({ at, serverNow }: { at: number; serverNow: number }) {
  const [offset] = useState(() => serverNow - Date.now());
  const [now, setNow] = useState(serverNow);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now() + offset), 1000);
    return () => clearInterval(t);
  }, [offset]);
  const left = Math.max(0, Math.ceil((at - now) / 1000));
  useEffect(() => {
    if (left === 0) window.location.reload();
  }, [left]);
  const h = Math.floor(left / 3600);
  const m = Math.floor((left % 3600) / 60);
  const s = left % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    <div className="rounded-lg border bg-card p-4">
      <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        <Hourglass className="size-3.5" /> Next set in
      </p>
      <p className="mt-1 font-mono text-2xl font-bold tabular-nums" suppressHydrationWarning>
        {pad(h)}:{pad(m)}:{pad(s)}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">A new daily set unlocks at 12:00 AM IST.</p>
    </div>
  );
}
