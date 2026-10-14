import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/session";
import { getProgress } from "@/lib/store";
import { getPyqSet, parsePyqSetId, pyqSetCount, pyqTrack } from "@/lib/pyq";
import { isUnlocked } from "@/lib/progress";
import { PracticeTest } from "@/components/practice-test-runner";

type Props = { params: Promise<{ setId: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return { title: `PYQ Set ${(await params).setId}` };
}

export default async function PyqTestPage({ params }: Props) {
  const user = await requireUser();
  const setId = await parsePyqSetId((await params).setId);
  const set = setId ? await getPyqSet(setId) : null;
  if (!set) notFound();
  const track = pyqTrack(await getProgress(user.id));
  if (!isUnlocked(track, set.setId, await pyqSetCount())) redirect("/pyq");
  if (track.sets[set.setId]?.status === "completed") redirect(`/pyq/${set.setId}/result`);
  // The timer starts (or resumes) from the browser, so a link prefetch never starts it.
  return <PracticeTest key={set.setId} setId={set.setId} routes={{ apiBase: "/api/pyq", pageBase: "/pyq", label: "PYQ" }} />;
}
