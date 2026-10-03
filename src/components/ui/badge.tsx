import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Badge({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border border-border bg-bg-subtle px-2 py-0.5 text-[11px] font-medium text-fg-muted",
        className,
      )}
    >
      {children}
    </span>
  );
}
