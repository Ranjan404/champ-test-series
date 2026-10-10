/** Phone-sized replacement for the topic tables: one stacked row per topic. */
export function TopicListMobile({
  rows,
}: {
  rows: { topic: string; correct: number; incorrect: number; notAttempted: number; accuracy: number | null; questions?: number }[];
}) {
  return (
    <ul className="-mx-4 divide-y border-y sm:hidden">
      {rows.map((t) => (
        <li key={t.topic} className="flex items-center justify-between gap-3 px-4 py-2.5">
          <div className="min-w-0">
            <p className="text-sm font-medium">{t.topic}</p>
            <p className="mt-0.5 font-mono text-xs">
              {t.questions !== undefined && <span className="text-muted-foreground">{t.questions} Qs · </span>}
              <span className="text-success">{t.correct}✓</span> <span className="text-danger">{t.incorrect}✗</span>{" "}
              <span className="text-muted-foreground">{t.notAttempted} NA</span>
            </p>
          </div>
          <span className="shrink-0 font-mono text-sm font-bold">{t.accuracy === null ? "-" : `${t.accuracy}%`}</span>
        </li>
      ))}
    </ul>
  );
}
