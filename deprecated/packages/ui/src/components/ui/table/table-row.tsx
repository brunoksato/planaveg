import type { HTMLAttributes } from "react";

import { cn } from "../../../lib/utils";

export function TableRow({ className, ...props }: HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      className={cn(
        "border-b transition-colors hover:bg-muted/40 aria-[current=true]:bg-accent/60",
        className,
      )}
      {...props}
    />
  );
}
