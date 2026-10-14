import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/session";
import { getProgress } from "@/lib/store";
import { getAllPyqSets, getPyqSet, parsePyqSetId, pyqSetCount, pyqTrack } from "@/lib/pyq";
import { buildSetReport } from "@/lib/report";
import { SetResultView } from "@/components/set-result-view";

type Props = { params: Promise<{ setId: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return { title: `PYQ Set ${(await params).setId} Result` };
}

export default async function PyqResultPage({ params }: Props) {
  const user = await requireUser();
  const setId = await parsePyqSetId((await params).setId);
  const set = setId ? await getPyqSet(setId) : null;
  if (!set) notFound();
  const track = pyqTrack(await getProgress(user.id));
  if (track.sets[set.setId]?.status !== "completed") redirect(track.unlockedUpTo >= set.setId ? `/pyq/${set.setId}` : "/pyq");
  const total = await pyqSetCount();
  return <SetResultView r={buildSetReport(set, track, await getAllPyqSets(), total)} pageBase="/pyq" apiBase="/api/pyq" label="PYQs" />;
}
