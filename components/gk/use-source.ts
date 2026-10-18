"use client";
import { useCallback, useEffect, useState } from "react";
import type { GkApiError } from "@/lib/gk/types";

export type SourceState<T> =
  | { status: "idle" | "loading" }
  | { status: "ok"; data: T }
  | { status: "error"; message: string; code: GkApiError["code"] | "network" | "unauthorized"; retryAfter?: number };

/** Fetches a GK/GS API route. Not cached on the client: the server keeps the transient source cache. */
export async function getSource<T>(url: string, signal?: AbortSignal): Promise<Exclude<SourceState<T>, { status: "idle" | "loading" }>> {
  let res: Response;
  try {
    res = await fetch(url, { signal, cache: "no-store" });
  } catch (e) {
    if ((e as Error).name === "AbortError") throw e;
    return { status: "error", code: "network", message: "" };
  }
  if (res.status === 401) {
    window.location.assign(`/login?next=${encodeURIComponent(window.location.pathname)}`);
    return { status: "error", code: "unauthorized", message: "" };
  }
  const body = (await res.json().catch(() => null)) as (T & Partial<GkApiError>) | null;
  if (!res.ok || !body) {
    const retry = Number(res.headers.get("retry-after"));
    return {
      status: "error",
      code: body?.code ?? "invalid",
      message: body?.error ?? `Request failed (HTTP ${res.status}).`,
      retryAfter: Number.isFinite(retry) && retry > 0 ? retry : undefined,
    };
  }
  return { status: "ok", data: body as T };
}

/** Loads `url` once per value (and again on reload()). Pass null to skip loading. */
export function useSource<T>(url: string | null) {
  const [state, setState] = useState<SourceState<T>>({ status: url ? "loading" : "idle" });
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (!url) {
      setState({ status: "idle" });
      return;
    }
    const ctrl = new AbortController();
    setState({ status: "loading" });
    getSource<T>(url, ctrl.signal).then(setState, (e) => {
      if ((e as Error).name !== "AbortError") setState({ status: "error", code: "network", message: "" });
    });
    return () => ctrl.abort();
  }, [url, nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  return { state, reload };
}
