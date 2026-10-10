"use client";
import { useState } from "react";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

const inputCls =
  "h-12 w-full rounded-md border border-input bg-background px-3.5 text-base outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/30";

export function LoginForm({ next }: { next?: string }) {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [show, setShow] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const form = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: form.get("username"), password: form.get("password") }),
      });
      if (!res.ok) {
        setError((await res.json().catch(() => null))?.error ?? "Login failed.");
        setLoading(false);
        return;
      }
      // Only follow same-site relative paths.
      const dest = next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
      window.location.assign(dest);
    } catch {
      setError("Network error. Try again.");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4" noValidate>
      <div className="grid gap-1.5">
        <label htmlFor="username" className="text-sm font-semibold">Username</label>
        <input id="username" name="username" autoComplete="username" autoCapitalize="none" spellCheck={false} required className={inputCls} />
      </div>
      <div className="grid gap-1.5">
        <label htmlFor="password" className="text-sm font-semibold">Password</label>
        <div className="relative">
          <input id="password" name="password" type={show ? "text" : "password"} autoComplete="current-password" required className={`${inputCls} pr-12`} />
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            className="absolute right-1 top-1 flex size-10 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
            aria-label={show ? "Hide password" : "Show password"}
          >
            {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
      </div>
      {error && (
        <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-sm font-medium text-danger">
          {error}
        </p>
      )}
      <Button type="submit" size="lg" disabled={loading} className="mt-1 w-full">
        {loading && <Loader2 className="animate-spin" />}
        {loading ? "Logging in..." : "Log in"}
      </Button>
    </form>
  );
}
