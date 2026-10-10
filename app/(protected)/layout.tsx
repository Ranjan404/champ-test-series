import { requireUser } from "@/lib/session";
import { Navbar } from "@/components/navbar";

export const dynamic = "force-dynamic";

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return (
    <div className="flex min-h-dvh flex-col">
      <Navbar username={user.username} />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-16 pt-6 sm:px-6 sm:pt-8 lg:px-8">{children}</main>
    </div>
  );
}
