"use client";
import * as React from "react";
import * as A from "@radix-ui/react-alert-dialog";
import { cn } from "@/lib/utils";
import { buttonVariants } from "./button";

export const AlertDialog = A.Root;
export const AlertDialogTrigger = A.Trigger;

export function AlertDialogContent({ className, children, ...props }: React.ComponentProps<typeof A.Content>) {
  return (
    <A.Portal>
      <A.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[2px]" />
      <A.Content
        className={cn(
          "fixed left-1/2 top-1/2 z-50 grid w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 gap-4 rounded-lg border bg-card p-5 shadow-xl sm:p-6",
          className,
        )}
        {...props}
      >
        {children}
      </A.Content>
    </A.Portal>
  );
}
export const AlertDialogTitle = ({ className, ...p }: React.ComponentProps<typeof A.Title>) => (
  <A.Title className={cn("text-lg font-bold", className)} {...p} />
);
export const AlertDialogDescription = ({ className, ...p }: React.ComponentProps<typeof A.Description>) => (
  <A.Description className={cn("text-sm text-muted-foreground", className)} {...p} />
);
export const AlertDialogFooter = ({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col-reverse gap-2 sm:flex-row sm:justify-end", className)} {...p} />
);
export const AlertDialogCancel = ({ className, ...p }: React.ComponentProps<typeof A.Cancel>) => (
  <A.Cancel className={cn(buttonVariants({ variant: "outline" }), className)} {...p} />
);
export const AlertDialogAction = ({ className, ...p }: React.ComponentProps<typeof A.Action>) => (
  <A.Action className={cn(buttonVariants({ variant: "danger" }), className)} {...p} />
);
