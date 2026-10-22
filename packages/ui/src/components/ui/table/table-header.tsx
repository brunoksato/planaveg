import type { HTMLAttributes } from "react";

import { cn } from "../../../lib/utils";

export function TableHeader({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={cn("bg-muted/60 [&_tr]:border-b", className)} {...props} />;
}
