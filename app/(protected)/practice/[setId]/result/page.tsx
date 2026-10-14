import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/session";
import { getProgress } from "@/lib/store";
import { getAllSets, getSet, parseSetId } from "@/lib/questions";
import { buildSetReport } from "@/lib/report";
import { SetResultView } from "@/components/set-result-view";

type Props = { params: Promise<{ setId: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return { title: `Set ${(await params).setId} Result` };
}

export default async function ResultPage({ params }: Props) {
  const user = await requireUser();
  const setId = parseSetId((await params).setId);
  const set = setId ? await getSet(setId) : null;
  if (!set) notFound();
  const progress = await getProgress(user.id);
  if (progress.sets[set.setId]?.status !== "completed") redirect(progress.unlockedUpTo >= set.setId ? `/practice/${set.setId}` : "/practice");
  return <SetResultView r={buildSetReport(set, progress, await getAllSets())} />;
}
