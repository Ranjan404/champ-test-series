"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RotateCcw } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export function ResetButton({
  setId,
  label = "Reset & Retry",
  goToTest = false,
  ...btn
}: { setId: number; label?: string; goToTest?: boolean } & Omit<ButtonProps, "onClick">) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function reset() {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/sets/${setId}/reset`, { method: "POST" }).catch(() => null);
    if (!res?.ok) {
      setError((await res?.json().catch(() => null))?.error ?? "Could not reset. Try again.");
      setBusy(false);
      return;
    }
    if (goToTest) router.push(`/practice/${setId}`);
    else router.refresh();
    setBusy(false);
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="outline" {...btn}>
          <RotateCcw /> {label}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogTitle>Reset Set {setId}?</AlertDialogTitle>
        <AlertDialogDescription>
          This deletes your answers and score for this attempt so you can start Set {setId} again from Question 1. Sets you have already unlocked
          stay unlocked, and finished attempts stay in your score history.
        </AlertDialogDescription>
        {error && <p className="text-sm font-medium text-danger">{error}</p>}
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              reset();
            }}
            disabled={busy}
          >
            {busy && <Loader2 className="animate-spin" />} Yes, reset
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
