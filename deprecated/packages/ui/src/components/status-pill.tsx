import type { ReactNode } from "react";

import { Badge, type BadgeProps } from "./ui/badge";

export type TomStatus = NonNullable<BadgeProps["variant"]>;

/** Pílula de estado: o tom diz o tipo (sucesso, aviso…), o texto diz o estado. */
export function StatusPill({
  tone,
  children,
  className,
}: {
  tone: TomStatus;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Badge className={className} variant={tone}>
      {children}
    </Badge>
  );
}
