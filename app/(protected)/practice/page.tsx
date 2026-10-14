import type { Metadata } from "next";
import { requireUser } from "@/lib/session";
import { getProgress } from "@/lib/store";
import { getAllSets } from "@/lib/questions";
import { buildSetList } from "@/lib/report";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { SetCard } from "@/components/set-card";
import { PRACTICE_DURATION_SECONDS } from "@/lib/types";

export const metadata: Metadata = { title: "Practice Sets" };

export default async function PracticePage() {
  const user = await requireUser();
  const [progress, sets] = await Promise.all([getProgress(user.id), getAllSets()]);
  const list = buildSetList(progress, sets);
  const done = list.filter((s) => s.status === "completed").length;
  const unlocked = list.filter((s) => s.unlocked).length;

  return (
    <>
      <PageHeader eyebrow="Practice" title="Practice Sets">
        <Badge variant="success" className="px-3 py-1 text-sm">{done} completed</Badge>
        <Badge className="px-3 py-1 text-sm">{unlocked} unlocked</Badge>
      </PageHeader>
      <p className="-mt-3 mb-6 max-w-2xl text-sm text-muted-foreground sm:-mt-5">
        Each set has 25 questions from across the syllabus and a {PRACTICE_DURATION_SECONDS / 60}-minute timer. Move freely with Save &amp; Next
        and Previous, then Submit to see your score, the correct answers and explanations. Correct +1, wrong -1/3, Not Attempted 0. Submitting
        a set unlocks the next one. Retaking a set replaces its previous result; unlocked sets stay unlocked.
      </p>
      <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4">
        {list.map((s) => (
          <SetCard key={s.setId} s={s} />
        ))}
      </div>
    </>
  );
}
