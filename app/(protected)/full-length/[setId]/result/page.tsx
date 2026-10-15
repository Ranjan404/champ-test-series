import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/session";
import { getProgress } from "@/lib/store";
import { getAllFullLengthSets, getFullLengthSet, parseFullLengthSetId, fullLengthSetCount, fullLengthTrack } from "@/lib/full-length";
import { buildSetReport } from "@/lib/report";
import { SetResultView } from "@/components/set-result-view";

type Props = { params: Promise<{ setId: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return { title: `Full Length Test ${(await params).setId} Result` };
}

export default async function FullLengthResultPage({ params }: Props) {
  const user = await requireUser();
  const setId = await parseFullLengthSetId((await params).setId);
  const set = setId ? await getFullLengthSet(setId) : null;
  if (!set) notFound();
  const track = fullLengthTrack(await getProgress(user.id));
  if (track.sets[set.setId]?.status !== "completed") redirect(track.unlockedUpTo >= set.setId ? `/full-length/${set.setId}` : "/full-length");
  const total = await fullLengthSetCount();
  return <SetResultView r={buildSetReport(set, track, await getAllFullLengthSets(), total)} pageBase="/full-length" apiBase="/api/full-length" label="Full Length Tests" />;
}
