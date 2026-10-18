import { GkShell } from "@/components/gk/gk-shell";

// Shared by every /gk page: the section tabs and the Hindi/English switch, whose choice carries across these pages.
export default function GkLayout({ children }: { children: React.ReactNode }) {
  return <GkShell>{children}</GkShell>;
}
