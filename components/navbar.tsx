"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { CalendarDays, GraduationCap, LayoutDashboard, ListChecks, LogOut, Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Logo } from "./logo";

const links = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/practice", label: "Practice Sets", icon: ListChecks },
  { href: "/daily", label: "Daily Question", icon: CalendarDays },
  { href: "/dashboard/bpsc-tre4", label: "GK/GS", icon: GraduationCap },
];

const matches = (pathname: string, href: string) => pathname === href || pathname.startsWith(href + "/");

async function logout() {
  await fetch("/api/auth/logout", { method: "POST" }).catch(() => null);
  window.location.assign("/login");
}

export function Navbar({ username }: { username: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [pathname]);
  // Most specific link wins, so /dashboard/bpsc-tre4 doesn't also light up Dashboard.
  const active = (href: string) => matches(pathname, href) && !links.some((l) => l.href.length > href.length && matches(pathname, l.href));

  return (
    <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4 sm:px-6 lg:px-8">
        <Link href="/dashboard" className="shrink-0" aria-label="Champ Test Series home">
          <Logo className="hidden text-base sm:inline-flex" />
          <Logo compact className="sm:hidden" />
        </Link>

        <nav className="ml-auto hidden items-center gap-1 lg:flex" aria-label="Main">
          {links.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              aria-current={active(href) ? "page" : undefined}
              className={cn(
                "inline-flex h-10 items-center gap-2 rounded-md px-3 text-sm font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                active(href) && "bg-primary/10 text-primary hover:bg-primary/10 hover:text-primary",
              )}
            >
              <Icon className="size-4" />
              {label}
            </Link>
          ))}
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
        <nav id="mobile-nav" className="border-t bg-background px-4 pb-4 pt-2 lg:hidden" aria-label="Main">
          <p className="px-3 pb-2 pt-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Signed in as {username}</p>
          {links.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              aria-current={active(href) ? "page" : undefined}
              className={cn("flex h-12 items-center gap-3 rounded-md px-3 font-semibold hover:bg-muted", active(href) && "bg-primary/10 text-primary")}
            >
              <Icon className="size-5" />
              {label}
            </Link>
          ))}
          <button onClick={logout} className="mt-1 flex h-12 w-full items-center gap-3 rounded-md px-3 font-semibold text-danger hover:bg-danger-soft">
            <LogOut className="size-5" /> Logout
          </button>
        </nav>
      )}
    </header>
  );
}
