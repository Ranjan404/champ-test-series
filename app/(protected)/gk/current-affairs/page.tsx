import type { Metadata } from "next";
import { CurrentAffairsPage } from "@/components/gk/pages";

export const metadata: Metadata = { title: "Current Affairs" };

export default function GkCurrentAffairsPage() {
  return <CurrentAffairsPage />;
}
