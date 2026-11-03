import type { ReactNode } from "react";

/**
 * O topo da lateral, fixo enquanto o resto rola: o que é a tela, uma ação no canto (recolher) e,
 * abaixo, os controles de sempre (resumo, busca).
 */
export function CabecalhoLateral({
  eyebrow,
  titulo,
  acao,
  children,
}: {
  eyebrow: string;
  titulo: ReactNode;
  acao?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="shrink-0 space-y-3 border-b bg-card px-4 pt-3 pb-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="eyebrow">{eyebrow}</p>
          <h1 className="mt-0.5 text-[15px] leading-snug font-semibold">{titulo}</h1>
        </div>
        {acao === undefined ? null : <div className="flex shrink-0 items-center">{acao}</div>}
      </div>
      {children}
    </div>
  );
}
