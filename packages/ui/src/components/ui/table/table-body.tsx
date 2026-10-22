import type { HTMLAttributes } from "react";

import { cn } from "../../../lib/utils";

export function TableBody({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={cn("[&_tr:last-child]:border-0", className)} {...props} />;
}
