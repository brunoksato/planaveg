import type { TdHTMLAttributes } from "react";

import { cn } from "../../../lib/utils";

export function TableCell({ className, ...props }: TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn("px-3 py-2.5 align-top", className)} {...props} />;
}
