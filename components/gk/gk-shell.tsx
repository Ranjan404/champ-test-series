"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Languages } from "lucide-react";
import { cn } from "@/lib/utils";
import { t, type StringKey } from "./i18n";
import { GkLanguageProvider, useGkLang } from "./language";
import { Segmented } from "./states";

const SECTIONS: { href: string; key: StringKey }[] = [
  { href: "/gk", key: "overview" },
  { href: "/gk/india", key: "india" },
  { href: "/gk/bihar", key: "bihar" },
  { href: "/gk/current-affairs", key: "currentAffairs" },
];

function SectionBar() {
  const pathname = usePathname();
  const { lang, setLang } = useGkLang();
  return (
    <div className="mb-6 flex flex-col gap-3 border-b pb-3 sm:mb-8 md:flex-row md:items-center md:justify-between">
      <nav aria-label={t(lang, "sections")} className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <ul className="flex min-w-max gap-1">
          {SECTIONS.map((s) => {
            const active = pathname === s.href;
            return (
              <li key={s.href}>
                <Link
                  href={s.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "inline-flex h-10 items-center rounded-md px-3 text-sm font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    active && "bg-primary/10 text-primary hover:bg-primary/10 hover:text-primary",
                  )}
                >
                  {t(lang, s.key)}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <div className="flex items-center gap-2">
        <Languages className="size-4 text-muted-foreground" aria-hidden />
        <Segmented
          label={t(lang, "language")}
          value={lang}
          onChange={setLang}
          options={[
            { value: "en", label: "English", lang: "en" },
            { value: "hi", label: "हिन्दी", lang: "hi" },
          ]}
        />
      </div>
    </div>
  );
}

export function GkShell({ children }: { children: React.ReactNode }) {
  return (
    <GkLanguageProvider>
      <SectionBar />
      {children}
    </GkLanguageProvider>
  );
}
