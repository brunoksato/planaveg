import { PanelLeftOpen } from "lucide-react";

import { type DimensaoFiltro, FiltrosDoMapa } from "@/modules/filtros";
import type { GeoServerApi } from "@/shared/api/geoserver";
import { AsideBody } from "@/shared/components/lateral/AsideBody";
import { BOTAO_LATERAL } from "@/shared/components/lateral/classes";
import { SecaoCompartilhar } from "@/shared/components/lateral/SecaoCompartilhar";
import type { Catalogo } from "@/shared/services/catalogo.service";

import type { EstadoDoMapa } from "../hooks/useEstadoDoMapa";
import type { MunicipioEscolhido } from "../hooks/useMunicipioEscolhido";
import type { NumerosDoMapa } from "../hooks/useNumerosDoMapa";
import type { AlteracaoMapa } from "../types";
import { BuscaDeMunicipio } from "./BuscaDeMunicipio";
import { CabecalhoDoMapa } from "./CabecalhoDoMapa";
import { DownloadsDoMapa } from "./DownloadsDoMapa";

/**
 * A lateral do mapa: o resumo e a busca no topo; abaixo, os filtros e o que baixar. Recolhida (só
 * no computador), vira uma faixa com o botão de abrir, e o mapa ganha a largura.
 */
export function LateralDoMapa({
  geoserver,
  catalogo,
  estado,
  numeros,
  municipio,
  municipioDaUrl,
  recolhida,
  onRecolher,
  onLimpar,
  onAlternar,
  onEstadoChange,
}: {
  geoserver: GeoServerApi;
  catalogo: Catalogo;
  estado: EstadoDoMapa;
  numeros: NumerosDoMapa;
  municipio: MunicipioEscolhido;
  /** O código do município escolhido, na URL. */
  municipioDaUrl: string | undefined;
  recolhida: boolean;
  onRecolher: (recolhida: boolean) => void;
  onLimpar: () => void;
  onAlternar: (dimensao: DimensaoFiltro, valor: string) => void;
  onEstadoChange: (alteracao: AlteracaoMapa) => void;
}) {
  return (
    <aside
      aria-label="Camadas do mapa"
      className={`flex min-h-0 flex-col border-t bg-card lg:h-[calc(100dvh-var(--header-h))] lg:shrink-0 lg:border-t-0 lg:border-r ${recolhida ? "lg:w-14" : "lg:w-[22.5rem]"}`}
    >
      {recolhida ? (
        <div className="flex justify-center py-3">
          <button
            aria-label="Mostrar a lateral"
            className={`${BOTAO_LATERAL} w-8 justify-center px-0`}
            onClick={() => onRecolher(false)}
            title="Mostrar a lateral"
            type="button"
          >
            <PanelLeftOpen aria-hidden />
          </button>
        </div>
      ) : (
        <>
          <CabecalhoDoMapa
            estado={estado}
            numeros={numeros}
            onLimpar={onLimpar}
            onRecolher={() => onRecolher(true)}
          >
            <BuscaDeMunicipio
              geoserver={geoserver}
              onEscolher={(codigo, feicao) => {
                onEstadoChange({ municipio: codigo });
                if (feicao !== undefined) municipio.irPara(feicao);
              }}
              rotulo={municipio.feicao?.propriedades.rotulo}
              valor={municipioDaUrl}
            />
          </CabecalhoDoMapa>
          <AsideBody>
            <FiltrosDoMapa
              catalogo={catalogo}
              filtros={estado.filtros}
              lugares={numeros.lugares}
              onAlternar={onAlternar}
              totais={numeros.somas?.porLista}
            />
            <SecaoCompartilhar>
              <DownloadsDoMapa estado={estado} geoserver={geoserver} municipio={municipioDaUrl} />
            </SecaoCompartilhar>
          </AsideBody>
        </>
      )}
    </aside>
  );
}
