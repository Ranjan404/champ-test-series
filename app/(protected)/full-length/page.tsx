import type { Metadata } from "next";
import { requireUser } from "@/lib/session";
import { getProgress } from "@/lib/store";
import { fullLengthSetCount, fullLengthTrack, getAllFullLengthSets } from "@/lib/full-length";
import { buildSetList } from "@/lib/report";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { SetCard } from "@/components/set-card";
import { FULL_LENGTH_DURATION_SECONDS } from "@/lib/types";

export const metadata: Metadata = { title: "Full Length Tests" };

export default async function FullLengthPage() {
  const user = await requireUser();
  const [progress, sets, total] = await Promise.all([getProgress(user.id), getAllFullLengthSets(), fullLengthSetCount()]);
  const list = buildSetList(fullLengthTrack(progress), sets, total);
  const done = list.filter((s) => s.status === "completed").length;
  const unlocked = list.filter((s) => s.unlocked).length;
  const sections = sets[0]?.sections ?? [];

  return (
    <>
      <PageHeader eyebrow="Exam Simulation" title="Full Length Tests">
        <Badge variant="success" className="px-3 py-1 text-sm">{done} completed</Badge>
        <Badge className="px-3 py-1 text-sm">{unlocked} unlocked</Badge>
      </PageHeader>
      <p className="-mt-3 mb-4 max-w-2xl text-sm text-muted-foreground sm:-mt-5">
        Complete exam-style papers of 150 questions with a {FULL_LENGTH_DURATION_SECONDS / 60}-minute timer. Move freely with Save &amp; Next, Previous
        and the section tabs, then Submit to see your score, the correct answers and explanations. Correct +1, wrong -1/3, Not Attempted 0. Submitting a
        test unlocks the next one. Retaking a test replaces its previous result; unlocked tests stay unlocked.
      </p>
      <p className="mb-6 max-w-2xl rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-sm">
        <span className="font-semibold">The timer pauses</span> when you press Pause, leave the test page, switch tabs or apps, or log out. Your answers
        are saved and the clock continues from where it stopped when you come back.
      </p>
      {sections.length > 0 && (
        <div className="mb-6 flex flex-wrap gap-2">
          {sections.map((sec) => (
            <Badge key={sec.name} variant="muted" className="px-3 py-1 text-sm">
              {sec.name} · {sec.to - sec.from + 1} Qs
            </Badge>
          ))}
        </div>
      )}
      {list.length === 0 ? (
        <p className="text-sm text-muted-foreground">No Full Length Tests are available yet.</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4">
          {list.map((s) => (
            <SetCard key={s.setId} s={s} pageBase="/full-length" apiBase="/api/full-length" minutes={FULL_LENGTH_DURATION_SECONDS / 60} noun="Test" />
          ))}
        </div>
      )}
    </>
  );
}
