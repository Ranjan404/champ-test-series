import type { Metadata } from "next";
import { requireUser } from "@/lib/session";
import { getProgress } from "@/lib/store";
import { getAllPyqSets, pyqSetCount, pyqTrack } from "@/lib/pyq";
import { buildSetList } from "@/lib/report";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { SetCard } from "@/components/set-card";
import { PRACTICE_DURATION_SECONDS } from "@/lib/types";

export const metadata: Metadata = { title: "PYQ Sets" };

export default async function PyqPage() {
  const user = await requireUser();
  const [progress, sets, total] = await Promise.all([getProgress(user.id), getAllPyqSets(), pyqSetCount()]);
  const list = buildSetList(pyqTrack(progress), sets, total);
  const done = list.filter((s) => s.status === "completed").length;
  const unlocked = list.filter((s) => s.unlocked).length;

  return (
    <>
      <PageHeader eyebrow="Previous Year Questions" title="PYQ Sets">
        <Badge variant="success" className="px-3 py-1 text-sm">{done} completed</Badge>
        <Badge className="px-3 py-1 text-sm">{unlocked} unlocked</Badge>
      </PageHeader>
      <p className="-mt-3 mb-6 max-w-2xl text-sm text-muted-foreground sm:-mt-5">
        Computer Science questions from previous Bihar STET and BPSC TRE papers, 25 per set, with a {PRACTICE_DURATION_SECONDS / 60}-minute timer.
        Each question shows its source paper on the result page. Move freely with Save &amp; Next and Previous, then Submit to see your score, the
        correct answers and explanations. Correct +1, wrong -1/3, Not Attempted 0. Submitting a set unlocks the next one. Retaking a set replaces its
        previous result; unlocked sets stay unlocked.
      </p>
      {list.length === 0 ? (
        <p className="text-sm text-muted-foreground">No PYQ sets are available yet.</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4">
          {list.map((s) => (
            <SetCard key={s.setId} s={s} pageBase="/pyq" apiBase="/api/pyq" />
          ))}
        </div>
      )}
    </>
  );
}
