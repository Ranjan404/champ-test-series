import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/session";
import { getProgress } from "@/lib/store";
import { getFullLengthSet, parseFullLengthSetId, fullLengthSetCount, fullLengthTrack } from "@/lib/full-length";
import { isUnlocked } from "@/lib/progress";
import { PracticeTest } from "@/components/practice-test-runner";

type Props = { params: Promise<{ setId: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return { title: `Full Length Test ${(await params).setId}` };
}

export default async function FullLengthTestPage({ params }: Props) {
  const user = await requireUser();
  const setId = await parseFullLengthSetId((await params).setId);
  const set = setId ? await getFullLengthSet(setId) : null;
  if (!set) notFound();
  const track = fullLengthTrack(await getProgress(user.id));
  if (!isUnlocked(track, set.setId, await fullLengthSetCount())) redirect("/full-length");
  if (track.sets[set.setId]?.status === "completed") redirect(`/full-length/${set.setId}/result`);
  // The timer starts (or resumes) from the browser, so a link prefetch never starts it.
  return <PracticeTest key={set.setId} setId={set.setId} routes={{ apiBase: "/api/full-length", pageBase: "/full-length", label: "Full Length" }} />;
}
