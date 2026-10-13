import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/session";
import { getProgress } from "@/lib/store";
import { getSet, parseSetId } from "@/lib/questions";
import { isUnlocked } from "@/lib/progress";
import { PracticeTest } from "@/components/practice-test-runner";

type Props = { params: Promise<{ setId: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return { title: `Set ${(await params).setId}` };
}

export default async function TestPage({ params }: Props) {
  const user = await requireUser();
  const setId = parseSetId((await params).setId);
  const set = setId ? await getSet(setId) : null;
  if (!set) notFound();
  const progress = await getProgress(user.id);
  if (!isUnlocked(progress, set.setId)) redirect("/practice");
  if (progress.sets[set.setId]?.status === "completed") redirect(`/practice/${set.setId}/result`);
  // The timer starts (or resumes) from the browser, so a link prefetch never starts it.
  return <PracticeTest key={set.setId} setId={set.setId} />;
}
