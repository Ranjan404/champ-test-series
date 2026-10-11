"use client";
import * as RadioGroup from "@radix-ui/react-radio-group";
import * as Checkbox from "@radix-ui/react-checkbox";
import { Check, CircleCheck, X } from "lucide-react";
import { useId } from "react";
import { cn } from "@/lib/utils";
import type { Letter, OptionKey, PublicQuestion } from "@/lib/types";
import { ALL_OPTIONS, LETTERS } from "@/lib/types";

interface Props {
  question: Pick<PublicQuestion, "type" | "options">;
  value: OptionKey[];
  onChange?: (v: OptionKey[]) => void;
  /** After submit (or on the result page): inputs disabled and answers coloured. */
  locked?: boolean;
  correct?: Letter[];
}

type RowState = "idle" | "selected" | "right" | "wrong" | "missed";

function rowState(key: OptionKey, value: OptionKey[], locked: boolean, correct?: Letter[]): RowState {
  const picked = value.includes(key);
  if (!locked || !correct) return picked ? "selected" : "idle";
  const isCorrect = key !== "E" && correct.includes(key as Letter);
  if (isCorrect && picked) return "right";
  if (isCorrect) return "missed";
  if (picked) return key === "E" ? "selected" : "wrong";
  return "idle";
}

const rowClass: Record<RowState, string> = {
  idle: "border-border bg-card",
  selected: "border-primary bg-primary/5 ring-1 ring-primary",
  right: "border-success bg-success-soft ring-1 ring-success",
  wrong: "border-danger bg-danger-soft ring-1 ring-danger",
  missed: "border-success border-dashed bg-success-soft/50",
};

function OptionRow({
  id,
  letter,
  text,
  state,
  locked,
  control,
}: {
  id: string;
  letter: OptionKey;
  text: string;
  state: RowState;
  locked: boolean;
  control: React.ReactNode;
}) {
  return (
    <label
      htmlFor={id}
      className={cn(
        "flex min-h-14 items-start gap-3 rounded-lg border p-3 text-left transition-colors sm:p-4",
        !locked && "cursor-pointer hover:border-primary/60 hover:bg-muted/60",
        letter === "E" && state === "idle" && "border-dashed",
        rowClass[state],
      )}
    >
      <span className="mt-0.5 shrink-0">{control}</span>
      <span className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="font-mono text-sm font-bold text-muted-foreground">{letter}.</span>
        <span className={cn("q-text min-w-0 flex-1 text-[15px] leading-relaxed", letter === "E" && "italic text-muted-foreground")}>{text}</span>
      </span>
      {state === "right" && <Check className="mt-0.5 size-5 shrink-0 text-success" aria-label="Correct" />}
      {state === "wrong" && <X className="mt-0.5 size-5 shrink-0 text-danger" aria-label="Wrong" />}
      {state === "missed" && <CircleCheck className="mt-0.5 size-5 shrink-0 text-success" strokeWidth={2.5} aria-label="Correct answer" />}
    </label>
  );
}

const radioCls =
  "flex size-5 items-center justify-center rounded-full border-2 border-input bg-card data-[state=checked]:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default";
const boxCls =
  "flex size-5 items-center justify-center rounded-[5px] border-2 border-input bg-card data-[state=checked]:border-primary data-[state=checked]:bg-primary text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default";

/** Radio buttons for single-select (A-E): exactly one choice. */
function RadioOptionGroup({ question, value, onChange, locked = false, correct }: Props) {
  const uid = useId();
  return (
    <RadioGroup.Root
      value={value[0] ?? ""}
      onValueChange={(v) => onChange?.([v as OptionKey])}
      disabled={locked}
      aria-label="Answer options"
      className="grid gap-2.5"
    >
      {ALL_OPTIONS.map((k) => (
        <OptionRow
          key={k}
          id={`${uid}-${k}`}
          letter={k}
          text={question.options[k]}
          locked={locked}
          state={rowState(k, value, locked, correct)}
          control={
            <RadioGroup.Item id={`${uid}-${k}`} value={k} className={radioCls}>
              <RadioGroup.Indicator className="size-2.5 rounded-full bg-primary" />
            </RadioGroup.Item>
          }
        />
      ))}
    </RadioGroup.Root>
  );
}

/** Checkboxes for multiple-select (A-D) plus E as a separate radio-style choice that clears the boxes. */
function CheckboxOptionGroup({ question, value, onChange, locked = false, correct }: Props) {
  const uid = useId();
  const toggle = (k: Letter, on: boolean) => {
    const letters = value.filter((v): v is Letter => v !== "E");
    const next = on ? [...letters, k] : letters.filter((x) => x !== k);
    onChange?.([...new Set(next)].sort() as OptionKey[]);
  };
  return (
    <div className="grid gap-2.5" role="group" aria-label="Answer options, select all correct options">
      {LETTERS.map((k) => (
        <OptionRow
          key={k}
          id={`${uid}-${k}`}
          letter={k}
          text={question.options[k]}
          locked={locked}
          state={rowState(k, value, locked, correct)}
          control={
            <Checkbox.Root id={`${uid}-${k}`} checked={value.includes(k)} onCheckedChange={(c) => toggle(k, c === true)} disabled={locked} className={boxCls}>
              <Checkbox.Indicator>
                <Check className="size-3.5" strokeWidth={3} />
              </Checkbox.Indicator>
            </Checkbox.Root>
          }
        />
      ))}
      <RadioGroup.Root value={value.includes("E") ? "E" : ""} onValueChange={() => onChange?.(["E"])} disabled={locked} aria-label="Not attempted">
        <OptionRow
          id={`${uid}-E`}
          letter="E"
          text={question.options.E}
          locked={locked}
          state={rowState("E", value, locked, correct)}
          control={
            <RadioGroup.Item id={`${uid}-E`} value="E" className={radioCls}>
              <RadioGroup.Indicator className="size-2.5 rounded-full bg-primary" />
            </RadioGroup.Item>
          }
        />
      </RadioGroup.Root>
    </div>
  );
}

export function OptionList(props: Props) {
  return props.question.type === "multiple" ? <CheckboxOptionGroup {...props} /> : <RadioOptionGroup {...props} />;
}
