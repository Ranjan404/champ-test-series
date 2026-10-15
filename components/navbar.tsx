"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import {
  CalendarDays,
  ChevronDown,
  ClipboardList,
  FileClock,
  GraduationCap,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Menu,
  Timer,
  X,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Logo } from "./logo";

type NavLink = { href: string; label: string; icon: LucideIcon };
type TestLink = NavLink & { description: string; tone: string };

const dashboard: NavLink = { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard };
const gkgs: NavLink = { href: "/dashboard/bpsc-tre4", label: "GK/GS", icon: GraduationCap };

/** The "Test" menu. `tone` colours each item's icon tile. */
const tests: TestLink[] = [
  {
    href: "/practice",
    label: "Practice Sets",
    icon: ListChecks,
    description: "25 questions · 25 min",
    tone: "bg-primary/10 text-primary",
  },
  {
    href: "/pyq",
    label: "PYQs",
    icon: FileClock,
    description: "Previous year papers",
    tone: "bg-warning-soft text-accent-foreground dark:text-warning",
  },
  {
    href: "/daily",
    label: "Daily Question",
    icon: CalendarDays,
    description: "A new set every day",
    tone: "bg-success-soft text-success",
  },
  {
    href: "/full-length",
    label: "Full Length Test",
    icon: Timer,
    description: "150 questions · 150 min",
    tone: "bg-danger-soft text-danger",
  },
];

const allLinks = [dashboard, ...tests, gkgs];

const matches = (pathname: string, href: string) => pathname === href || pathname.startsWith(href + "/");

async function logout() {
  await fetch("/api/auth/logout", { method: "POST" }).catch(() => null);
  window.location.assign("/login");
}

const topLink =
  "inline-flex h-10 items-center gap-2 rounded-md px-3 text-sm font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground";
const topActive = "bg-primary/10 text-primary hover:bg-primary/10 hover:text-primary";

function TestItem({ t, active, large }: { t: TestLink; active: boolean; large?: boolean }) {
  const Icon = t.icon;
  return (
    <Link
      href={t.href}
      role={large ? "menuitem" : undefined}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group flex items-center gap-3 rounded-lg p-2.5 transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:outline-none",
        active && "bg-primary/5 ring-1 ring-primary/30",
      )}
    >
      <span className={cn("flex shrink-0 items-center justify-center rounded-lg transition-transform group-hover:scale-105", large ? "size-10" : "size-9", t.tone)}>
        <Icon className={large ? "size-5" : "size-[18px]"} />
      </span>
      <span className="min-w-0">
        <span className={cn("block text-sm font-semibold", active && "text-primary")}>{t.label}</span>
        <span className="block truncate text-xs text-muted-foreground">{t.description}</span>
      </span>
    </Link>
  );
}

/** Desktop "Test" dropdown: opens on click or hover, closes on outside click, Escape or navigation. */
function TestMenu({ isActive }: { isActive: (href: string) => boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const hoverTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  // A click right after hover opened the menu keeps it open instead of closing it.
  const hoverOpened = useRef(false);
  const menuId = useId();
  const pathname = usePathname();
  const anyActive = tests.some((t) => isActive(t.href));

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        ref.current?.querySelector("button")?.focus();
      }
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const hover = (next: boolean) => {
    clearTimeout(hoverTimer.current);
    hoverTimer.current = setTimeout(() => {
      hoverOpened.current = next;
      setOpen(next);
    }, next ? 60 : 180);
  };
  const toggle = () => {
    clearTimeout(hoverTimer.current);
    if (open && hoverOpened.current) hoverOpened.current = false;
    else setOpen((o) => !o);
  };

  return (
    <div
      ref={ref}
      className="relative"
      onPointerEnter={(e) => e.pointerType === "mouse" && hover(true)}
      onPointerLeave={(e) => e.pointerType === "mouse" && hover(false)}
    >
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={menuId}
        className={cn(topLink, (anyActive || open) && topActive)}
      >
        <ClipboardList className="size-4" />
        Test
        <ChevronDown className={cn("size-4 transition-transform duration-200", open && "rotate-180")} />
      </button>
      <div
        id={menuId}
        role="menu"
        aria-label="Tests"
        className={cn(
          "absolute left-1/2 top-full z-50 w-[30rem] -translate-x-1/2 pt-2 transition-all duration-150",
          open ? "visible translate-y-0 opacity-100" : "invisible -translate-y-1 opacity-0",
        )}
      >
        <div className="overflow-hidden rounded-xl border bg-card shadow-xl">
          <div className="grid grid-cols-2 gap-1 p-2">
            {tests.map((t) => (
              <TestItem key={t.href} t={t} active={isActive(t.href)} large />
            ))}
          </div>
          <p className="border-t bg-muted/50 px-4 py-2 text-xs text-muted-foreground">Timed tests with instant scores and answer explanations.</p>
        </div>
      </div>
    </div>
  );
}

export function Navbar({ username }: { username: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [testsOpen, setTestsOpen] = useState(true);
  useEffect(() => setOpen(false), [pathname]);
  // Most specific link wins, so /dashboard/bpsc-tre4 doesn't also light up Dashboard.
  const active = (href: string) => matches(pathname, href) && !allLinks.some((l) => l.href.length > href.length && matches(pathname, l.href));
  const anyTestActive = tests.some((t) => active(t.href));

  return (
    <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4 sm:px-6 lg:px-8">
        <Link href="/dashboard" className="shrink-0" aria-label="Champ Test Series home">
          <Logo className="hidden text-base sm:inline-flex" />
          <Logo compact className="sm:hidden" />
        </Link>

        <nav className="ml-auto hidden items-center gap-1 lg:flex" aria-label="Main">
          {[dashboard, null, gkgs].map((l) =>
            l ? (
              <Link key={l.href} href={l.href} aria-current={active(l.href) ? "page" : undefined} className={cn(topLink, active(l.href) && topActive)}>
                <l.icon className="size-4" />
                {l.label}
              </Link>
            ) : (
              <TestMenu key="tests" isActive={active} />
            ),
          )}
        </nav>

        <div className="ml-auto hidden items-center gap-3 lg:ml-2 lg:flex">
          <span className="max-w-32 truncate text-sm text-muted-foreground" title={username}>
            {username}
          </span>
          <button onClick={logout} className="inline-flex h-10 items-center gap-2 rounded-md border px-3 text-sm font-semibold hover:bg-muted">
            <LogOut className="size-4" /> Logout
          </button>
        </div>

        <button
          className="ml-auto inline-flex size-11 items-center justify-center rounded-md border lg:hidden"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-controls="mobile-nav"
          aria-label={open ? "Close menu" : "Open menu"}
        >
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>

      {open && (
        <nav id="mobile-nav" className="max-h-[calc(100dvh-4rem)] overflow-y-auto border-t bg-background px-4 pb-4 pt-2 lg:hidden" aria-label="Main">
          <p className="px-3 pb-2 pt-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Signed in as {username}</p>
          <Link
            href={dashboard.href}
            aria-current={active(dashboard.href) ? "page" : undefined}
            className={cn("flex h-12 items-center gap-3 rounded-md px-3 font-semibold hover:bg-muted", active(dashboard.href) && "bg-primary/10 text-primary")}
          >
            <LayoutDashboard className="size-5" />
            Dashboard
          </Link>

          <button
            type="button"
            onClick={() => setTestsOpen((o) => !o)}
            aria-expanded={testsOpen}
            aria-controls="mobile-tests"
            className={cn("flex h-12 w-full items-center gap-3 rounded-md px-3 font-semibold hover:bg-muted", anyTestActive && "text-primary")}
          >
            <ClipboardList className="size-5" />
            Test
            <ChevronDown className={cn("ml-auto size-5 transition-transform duration-200", testsOpen && "rotate-180")} />
          </button>
          {testsOpen && (
            <div id="mobile-tests" className="mb-1 ml-5 grid gap-1 border-l-2 border-primary/20 pl-3 min-[480px]:grid-cols-2">
              {tests.map((t) => (
                <TestItem key={t.href} t={t} active={active(t.href)} />
              ))}
            </div>
          )}

          <Link
            href={gkgs.href}
            aria-current={active(gkgs.href) ? "page" : undefined}
            className={cn("flex h-12 items-center gap-3 rounded-md px-3 font-semibold hover:bg-muted", active(gkgs.href) && "bg-primary/10 text-primary")}
          >
            <GraduationCap className="size-5" />
            GK/GS
          </Link>
          <button onClick={logout} className="mt-1 flex h-12 w-full items-center gap-3 rounded-md px-3 font-semibold text-danger hover:bg-danger-soft">
            <LogOut className="size-5" /> Logout
          </button>
        </nav>
      )}
    </header>
  );
}
