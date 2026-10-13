import type { Metadata } from "next";
import { DailyTest } from "@/components/daily-test";

export const metadata: Metadata = { title: "Daily Test" };

export default function DailyTestPage() {
  return <DailyTest />;
}
