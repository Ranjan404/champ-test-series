import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/session";
import { getProgress } from "@/lib/store";
import { getSet, parseSetId } from "@/lib/questions";
import { isUnlocked } from "@/lib/progress";
import { buildTestState } from "@/lib/test-state";
import { TestRunner } from "@/components/test-runner";

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
  const state = buildTestState(set, progress);
  if (state.status === "completed") redirect(`/practice/${set.setId}/result`);
  return <TestRunner initial={state} />;
}
