import type { Metadata } from "next";
import { CheckCircle2, Phone } from "lucide-react";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { CONTACT_PHONE_DISPLAY, callHref, whatsappHref } from "@/lib/contact";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Log in" };

const PERKS = [
  "50 full practice sets, 1,250 exam-level questions",
  "31+ PYQ sets: 775 questions from BPSC TRE 1.0, 2.0, 3.0 and Bihar STET papers",
  "10+ full length tests: 150 questions in 150 minutes, just like the real exam",
  "Full length sections: Language (English & Hindi), GK & GS and Computer Science",
  "Daily set: a fresh 25-question set every day for regular practice",
  "GK/GS mock tests on Bihar history, geography, economy and current affairs, in English or Hindi",
  "Real exam marking: +1 for right, -1/3 for wrong",
  "Pause a full length test anytime and continue right where you left off",
  "Instant answers with clear feedback after every question",
  "Track your score and weak topics on your dashboard",
];

function WhatsAppIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden {...props}>
      <path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.49-1.77-1.66-2.07-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.61-.92-2.21-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.21 3.08c.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.69.63.71.23 1.36.2 1.87.12.57-.08 1.76-.72 2.01-1.42.25-.7.25-1.29.17-1.42-.07-.12-.27-.2-.57-.35ZM12.05 21.5h-.01a9.4 9.4 0 0 1-4.79-1.31l-.34-.2-3.56.93.95-3.47-.22-.36a9.39 9.39 0 0 1-1.44-5.01c0-5.19 4.23-9.42 9.43-9.42a9.36 9.36 0 0 1 6.66 2.76 9.36 9.36 0 0 1 2.76 6.67c0 5.2-4.23 9.42-9.43 9.42Zm8.02-17.44A11.27 11.27 0 0 0 12.05.75C5.8.75.71 5.84.71 12.09c0 2 .52 3.95 1.52 5.67L.62 23.25l5.62-1.47a11.3 11.3 0 0 0 5.8 1.48h.01c6.25 0 11.34-5.09 11.34-11.34 0-3.03-1.18-5.88-3.32-8.02Z" />
    </svg>
  );
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden px-4 py-10">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 [background:radial-gradient(60rem_30rem_at_50%_-10%,color-mix(in_oklch,var(--primary)_14%,transparent),transparent),radial-gradient(30rem_20rem_at_100%_100%,color-mix(in_oklch,var(--accent)_18%,transparent),transparent)]"
      />
      <div className="relative w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <Logo className="text-xl" />
          <p className="mt-3 text-sm font-medium">
            Practice like it's exam day. Score higher when it counts.
          </p>
        </div>
        <div className="rounded-lg border bg-card p-5 shadow-lg shadow-black/5 sm:p-7">
          <h1 className="text-xl font-bold">Welcome back, champ!</h1>
          <p className="mb-6 mt-1 text-sm text-muted-foreground">
            Log in to continue your preparation.
          </p>
          <LoginForm next={next} />
        </div>

        <section
          className="mt-5 rounded-lg border border-primary/30 bg-primary/5 p-5 sm:p-6"
          aria-labelledby="join-heading"
        >
          <h2 id="join-heading" className="text-base font-bold">
            New here? Join the Champ Test Series
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Every set you solve is one step closer to your selection. Start
            practising today and walk into your exam with confidence.
          </p>
          <ul className="mt-4 grid gap-2 text-sm">
            {PERKS.map((p) => (
              <li key={p} className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" />
                <span>{p}</span>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-sm font-semibold">
            Call or WhatsApp us to get your login ID and password:
          </p>
          <p className="mt-1 font-mono text-lg font-bold tracking-wide">
            {CONTACT_PHONE_DISPLAY}
          </p>
          <div className="mt-4 grid grid-cols-2 gap-2.5">
            <Button asChild variant="outline">
              <a href={callHref}>
                <Phone /> Call now
              </a>
            </Button>
            <Button
              asChild
              className="bg-[#25D366] text-white hover:bg-[#1ebe5b]"
            >
              <a href={whatsappHref} target="_blank" rel="noopener noreferrer">
                <WhatsAppIcon /> WhatsApp
              </a>
            </Button>
          </div>
        </section>
      </div>
    </main>
  );
}
