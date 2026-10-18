"use client";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { GkLang } from "@/lib/gk/types";

// The Hindi/English choice for the GK/GS section. It lives in the /gk layout, so it survives navigation between
// the GK/GS pages, and is remembered in this browser only (localStorage), never on the server.

const STORAGE_KEY = "cts:gk-lang";

const LanguageContext = createContext<{ lang: GkLang; setLang: (l: GkLang) => void } | null>(null);

export function GkLanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<GkLang>("en");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === "en" || saved === "hi") setLangState(saved);
    } catch {
      // Storage blocked: fall back to English for this visit.
    }
  }, []);

  const setLang = useCallback((l: GkLang) => {
    setLangState(l);
    try {
      localStorage.setItem(STORAGE_KEY, l);
    } catch {
      // Not remembered; the choice still applies until the tab is closed.
    }
  }, []);

  return <LanguageContext.Provider value={{ lang, setLang }}>{children}</LanguageContext.Provider>;
}

export function useGkLang() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useGkLang must be used inside GkLanguageProvider");
  return ctx;
}
