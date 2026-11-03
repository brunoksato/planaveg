import type { SelectHTMLAttributes } from "react";

import { cn } from "../../lib/utils";

/**
 * Select nativo estilizado: preserva teclado, leitores de tela e seleção múltipla sem
 * depender de popovers; o visual segue os demais campos.
 */
export function NativeSelect({
  className,
  multiple,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "w-full rounded-md border border-input bg-card px-3 text-sm text-foreground shadow-xs transition-colors hover:border-ring/60 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50",
        multiple
          ? "min-h-28 py-1.5 [&>option]:rounded-sm [&>option]:px-1.5 [&>option]:py-1"
          : "h-9",
        className,
      )}
      multiple={multiple}
      {...props}
    />
  );
}
