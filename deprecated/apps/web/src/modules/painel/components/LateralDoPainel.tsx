import { RotateCcw } from "lucide-react";
import { useState } from "react";

import {
  type DimensaoFiltro,
  type FiltrosAreas,
  FiltrosDoPainel,
  type LinhaFaceta,
  ResumoDasAreas,
  temFiltros,
  type Total,
} from "@/modules/filtros";
import type { GeoServerApi } from "@/shared/api/geoserver";
import { AsideBody } from "@/shared/components/lateral/AsideBody";
import { CabecalhoLateral } from "@/shared/components/lateral/CabecalhoLateral";
import { BOTAO_LATERAL } from "@/shared/components/lateral/classes";
import { SecaoCompartilhar } from "@/shared/components/lateral/SecaoCompartilhar";
import type { Catalogo } from "@/shared/services/catalogo.service";
import type { NomeDimensao } from "@/shared/utils/glossario";
import { telaLarga } from "@/shared/utils/tela";

import type { ValorRanking } from "../services/lugar.service";
import type { AlteracaoPainel } from "../types";
import { EscolhaDoLugar } from "./EscolhaDoLugar";

/**
 * A lateral do painel, como a do mapa: o lugar (Brasil, ou um estado, município, bacia…) e os
 * filtros das áreas. No computador, ela acompanha a rolagem da página.
 */
export function LateralDoPainel({
  geoserver,
  catalogo,
  dimensao,
  chave,
  nomes,
  lugar,
  ranking,
  filtros,
  linhas,
  total,
  falhou,
  onEstadoChange,
  onAlternar,
  onLimpar,
}: {
  geoserver: GeoServerApi;
  catalogo: Catalogo;
  dimensao: string | undefined;
  chave: string | undefined;
  nomes: NomeDimensao | undefined;
  lugar: string;
  ranking: readonly ValorRanking[];
  filtros: FiltrosAreas;
  /** As facetas do lugar no ano; `undefined` enquanto carregam. */
  linhas: readonly LinhaFaceta[] | undefined;
  /** O total das áreas filtradas (o do resumo do painel); `undefined` enquanto carregam. */
  total: Total | undefined;
  /** Os quantitativos não vieram. */
  falhou: boolean;
  onEstadoChange: (alteracao: AlteracaoPainel) => void;
  onAlternar: (dimensao: DimensaoFiltro, valor: string) => void;
  onLimpar: () => void;
}) {
  // No computador, a lista de tipos de área vem aberta; no celular, recolhida, para os números
  // aparecerem logo abaixo das escolhas.
  const [tiposAbertos] = useState(() => temFiltros(filtros) || telaLarga());
  return (
    <div className="border-b bg-card lg:w-[22.5rem] lg:shrink-0 lg:border-r lg:border-b-0">
      <aside aria-label="Escolhas do painel" className="flex flex-col lg:sticky lg:top-0 lg:h-dvh">
        <CabecalhoLateral eyebrow="Painel" titulo="Vegetação em recuperação">
          <div className="flex min-h-9 items-center justify-end gap-2">
            {temFiltros(filtros) ? (
              <button className={BOTAO_LATERAL} onClick={onLimpar} type="button">
                <RotateCcw aria-hidden />
                Voltar ao padrão
              </button>
            ) : null}
          </div>
          <ResumoDasAreas falhou={falhou} filtros={filtros} total={total} />
          <EscolhaDoLugar
            catalogo={catalogo}
            chave={chave}
            dimensao={dimensao}
            geoserver={geoserver}
            lugar={lugar}
            nomes={nomes}
            onEstadoChange={onEstadoChange}
            ranking={ranking}
          />
        </CabecalhoLateral>
        <AsideBody>
          <FiltrosDoPainel
            catalogo={catalogo}
            filtros={filtros}
            linhas={linhas}
            onAlternar={onAlternar}
            tiposAbertos={tiposAbertos}
          />
          <SecaoCompartilhar />
        </AsideBody>
      </aside>
    </div>
  );
}
