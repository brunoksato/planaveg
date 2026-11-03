import { Check, ChevronDown, Link2, Share2 } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

import { BOTAO_LATERAL } from "./classes";

/**
 * O fim da lateral, num acordeão nativo que começa aberto (acessível por teclado): copiar o link
 * (que guarda tudo o que está na tela) e os downloads e a outra tela, passados como filhos.
 */
export function SecaoCompartilhar({ children }: { children?: ReactNode }) {
  const [copiado, setCopiado] = useState(false);
  // "Link copiado" volta a "Copiar o link" em dois segundos; se a lateral sai da tela antes, o
  // relógio é cancelado junto.
  useEffect(() => {
    if (!copiado) return;
    const relogio = setTimeout(() => setCopiado(false), 2_000);
    return () => clearTimeout(relogio);
  }, [copiado]);
  async function copiar() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopiado(true);
    } catch {
      // Sem acesso à área de transferência (contexto inseguro): o endereço continua na barra.
    }
  }
  return (
    <details
      aria-labelledby="compartilhar-titulo"
      className="group border-b"
      id="compartilhar"
      open
    >
      <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-2.5 text-sm font-semibold hover:bg-muted/50 [&::-webkit-details-marker]:hidden">
        <span className="text-primary [&_svg]:size-4">
          <Share2 aria-hidden />
        </span>
        <span className="flex-1" id="compartilhar-titulo">
          Compartilhar e baixar
        </span>
        <ChevronDown
          aria-hidden
          className="size-4 text-muted-foreground transition-transform group-open:rotate-180"
        />
      </summary>
      <div className="space-y-3 px-4 pt-1 pb-4">
        <p className="text-[13px] text-muted-foreground">
          O link guarda o lugar, os filtros e a vista.
        </p>
        <button className={BOTAO_LATERAL} onClick={() => void copiar()} type="button">
          {copiado ? <Check aria-hidden /> : <Link2 aria-hidden />}
          <span aria-live="polite">{copiado ? "Link copiado" : "Copiar o link"}</span>
        </button>
        {children === undefined ? null : (
          <div className="flex flex-col items-start gap-2">{children}</div>
        )}
      </div>
    </details>
  );
}
