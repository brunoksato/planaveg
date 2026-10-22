import type { ThHTMLAttributes } from "react";

import { cn } from "../../../lib/utils";

export function TableRowHeader({ className, ...props }: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={cn("px-3 py-2.5 text-left align-top font-medium", className)}
      scope="row"
      {...props}
    />
  );
}
