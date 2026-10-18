import type { Metadata } from "next";
import { GkHub } from "@/components/gk/pages";

export const metadata: Metadata = { title: "GK/GS & Current Affairs" };

export default function GkPage() {
  return <GkHub />;
}
