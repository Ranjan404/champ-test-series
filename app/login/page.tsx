import type { Metadata } from "next";
import { Logo } from "@/components/logo";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Log in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden px-4 py-10">
      <div aria-hidden className="pointer-events-none absolute inset-0 [background:radial-gradient(60rem_30rem_at_50%_-10%,color-mix(in_oklch,var(--primary)_14%,transparent),transparent),radial-gradient(30rem_20rem_at_100%_100%,color-mix(in_oklch,var(--accent)_18%,transparent),transparent)]" />
      <div className="relative w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <Logo className="text-xl" />
          <p className="mt-3 text-sm text-muted-foreground">50 practice sets · 25 questions each · +1 / -1/3 marking</p>
        </div>
        <div className="rounded-lg border bg-card p-5 shadow-lg shadow-black/5 sm:p-7">
          <h1 className="text-xl font-bold">Log in</h1>
          <p className="mb-6 mt-1 text-sm text-muted-foreground">Use the account your admin created for you.</p>
          <LoginForm next={next} />
        </div>
      </div>
    </main>
  );
}
