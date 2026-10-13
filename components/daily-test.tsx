"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Loader2 } from "lucide-react";
import type { DailyState } from "@/lib/daily";
import { DailyTestRunner } from "./daily-test-runner";
import { Button } from "./ui/button";

type Loaded = { state: DailyState; clockOffset: number };

/** Starts (or resumes) today's daily attempt on the server, then hands it to the runner. */
export function DailyTest() {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const sent = Date.now();
        const res = await fetch("/api/daily/start", { method: "POST" });
        if (res.status === 401) return window.location.assign("/login?next=/daily/test");
        const data = await res.json().catch(() => null);
        if (!res.ok) throw new Error(data?.error ?? "Could not start the test.");
        const state = data as DailyState;
        // Assume the server stamped its clock halfway through the round trip.
        const clockOffset = state.serverNow - (sent + Date.now()) / 2;
        if (!cancelled) setLoaded({ state, clockOffset });
      } catch (e) {
        if (!cancelled) setError((e as Error).message || "Network error. Check your connection and try again.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <AlertTriangle className="mx-auto size-8 text-danger" />
        <p role="alert" className="mt-3 font-semibold">{error}</p>
        <Button asChild variant="outline" className="mt-6">
          <Link href="/daily">Back to Daily Question</Link>
        </Button>
      </div>
    );
  }
  if (!loaded?.state.attempt) {
    return (
      <div className="flex flex-col items-center py-20" role="status">
        <Loader2 className="size-8 animate-spin text-primary" />
        <p className="mt-4 font-semibold">Loading today&apos;s test…</p>
      </div>
    );
  }
  return <DailyTestRunner attempt={loaded.state.attempt} clockOffset={loaded.clockOffset} />;
}
