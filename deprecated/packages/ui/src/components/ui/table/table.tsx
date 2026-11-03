import type { HTMLAttributes } from "react";

import { cn } from "../../../lib/utils";

export function Table({
  className,
  containerClassName,
  ...props
}: HTMLAttributes<HTMLTableElement> & { containerClassName?: string }) {
  return (
    <div
      className={cn(
        "relative w-full overflow-x-auto rounded-md border bg-card",
        containerClassName,
      )}
    >
      <table className={cn("w-full caption-bottom text-sm", className)} {...props} />
    </div>
  );
}
