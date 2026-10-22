import { Loader2 } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "../lib/utils";

/** Estado de carregamento anunciado por leitores de tela (`output` + aria-busy). */
export function LoadingState({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <output
      aria-busy="true"
      aria-live="polite"
      className={cn(
        "flex items-center gap-2 rounded-md border bg-card px-4 py-3 text-sm text-muted-foreground",
        className,
      )}
    >
      <span aria-hidden className="inline-flex size-4 animate-spin text-primary">
        <Loader2 className="size-4" />
      </span>
      <p>{children}</p>
    </output>
  );
}
