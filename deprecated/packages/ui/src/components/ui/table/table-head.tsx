import type { ThHTMLAttributes } from "react";

import { cn } from "../../../lib/utils";

export function TableHead({ className, ...props }: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={cn(
        "h-10 px-3 text-left align-middle text-xs font-semibold whitespace-nowrap text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
}
