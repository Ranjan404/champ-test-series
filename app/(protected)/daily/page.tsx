import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Daily Question" };

export default function DailyPage() {
  return (
    <div className="mx-auto flex max-w-lg flex-col items-center py-10 text-center sm:py-20">
      <div className="mb-6 flex size-20 items-center justify-center rounded-2xl bg-accent/20 text-accent-foreground dark:text-accent">
        <CalendarDays className="size-10" />
      </div>
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">Daily Question</p>
      <h1 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">Coming Soon</h1>
      <p className="mt-3 text-muted-foreground">A fresh syllabus question every day is on the way. Until then, keep going with the practice sets.</p>
      <Button asChild className="mt-8" size="lg">
        <Link href="/practice">Go to Practice Sets</Link>
      </Button>
    </div>
  );
}
