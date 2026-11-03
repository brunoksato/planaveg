import type { ReactNode } from "react";

/** O corpo da lateral, que rola sozinho sob o cabeçalho fixo. */
export function AsideBody({ children }: { children: ReactNode }) {
  // `relative`: o texto só para leitores de tela (`sr-only`, posição absoluta) fica preso aqui;
  // sem isso, o do fim da lista esticava a página e o mapa rolava junto.
  return <div className="relative min-h-0 flex-1 overflow-y-auto scrollbar-thin">{children}</div>;
}
