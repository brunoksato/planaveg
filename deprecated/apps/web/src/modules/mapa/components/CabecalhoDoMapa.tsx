import { PanelLeftClose, RotateCcw } from "lucide-react";
import type { ReactNode } from "react";

import { ResumoDasAreas } from "@/modules/filtros";
import { CabecalhoLateral } from "@/shared/components/lateral/CabecalhoLateral";
import { BOTAO_LATERAL } from "@/shared/components/lateral/classes";

import type { EstadoDoMapa } from "../hooks/useEstadoDoMapa";
import type { NumerosDoMapa } from "../hooks/useNumerosDoMapa";

/**
 * O topo da lateral do mapa: "Voltar ao padrão", o resumo do que está no mapa e a busca de
 * município (`children`). O mapa mostra só a base mais recente, sem escolher o ano.
 */
export function CabecalhoDoMapa({
  estado,
  numeros,
  onRecolher,
  onLimpar,
  children,
}: {
  estado: EstadoDoMapa;
  numeros: NumerosDoMapa;
  onRecolher: () => void;
  onLimpar: () => void;
  children: ReactNode;
}) {
  return (
    <CabecalhoLateral
      acao={
        <button
          aria-label="Recolher a lateral"
          className={`${BOTAO_LATERAL} w-8 justify-center px-0 max-lg:hidden`}
          onClick={onRecolher}
          title="Recolher a lateral"
          type="button"
        >
          <PanelLeftClose aria-hidden />
        </button>
      }
      eyebrow="Mapa"
      titulo="Vegetação em recuperação"
    >
      {/* Sempre da mesma altura: o botão aparecer não empurra o que vem abaixo. */}
      <div className="flex min-h-9 items-center justify-end gap-2">
        {estado.foraDoPadrao ? (
          <button className={BOTAO_LATERAL} onClick={onLimpar} type="button">
            <RotateCcw aria-hidden />
            Voltar ao padrão
          </button>
        ) : null}
      </div>
      <ResumoDasAreas
        falhou={numeros.facetas.isError}
        filtrando={estado.filtrado}
        filtros={estado.filtros}
        total={numeros.somas?.total}
      />
      {children}
    </CabecalhoLateral>
  );
}
