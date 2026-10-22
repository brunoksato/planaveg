import type { ReactNode, Ref } from "react";

/** Um botão quadrado sobre o mapa, só com ícone; o nome vai para leitores de tela e dica. */
export function BotaoMapa({
  rotulo,
  onClick,
  expandido,
  controla,
  ref,
  children,
}: {
  rotulo: string;
  onClick: () => void;
  /** Para o botão que abre um painel: se ele está aberto, e qual é. */
  expandido?: boolean;
  controla?: string;
  ref?: Ref<HTMLButtonElement>;
  children: ReactNode;
}) {
  return (
    <button
      aria-controls={controla}
      aria-expanded={expandido}
      aria-label={rotulo}
      className="grid size-9 place-content-center rounded-md border bg-card shadow hover:bg-muted aria-expanded:border-primary aria-expanded:text-primary"
      onClick={onClick}
      ref={ref}
      title={rotulo}
      type="button"
    >
      {children}
    </button>
  );
}
