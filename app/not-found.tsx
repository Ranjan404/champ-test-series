import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-4 text-center">
      <p className="font-mono text-6xl font-bold text-primary">404</p>
      <h1 className="mt-3 text-2xl font-extrabold">Page not found</h1>
      <p className="mt-2 text-muted-foreground">That page doesn&apos;t exist.</p>
      <Button asChild className="mt-6">
        <Link href="/dashboard">Go to Dashboard</Link>
      </Button>
    </main>
  );
}
