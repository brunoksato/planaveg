import {
  alternarNaUrl,
  alternarTipoDeArea,
  DIMENSOES_DO_PAINEL,
  limparNaUrl,
} from "@/modules/filtros";
import type { GeoServerApi } from "@/shared/api/geoserver";
import type { Catalogo } from "@/shared/services/catalogo.service";

import { usePainel } from "../hooks/usePainel";
import { useRolarParaOAssunto } from "../hooks/useRolarParaOAssunto";
import type { AlteracaoPainel, EstadoPainel } from "../types";
import { CabecalhoDoPainel } from "./CabecalhoDoPainel";
import { ConteudoDoPainel } from "./ConteudoDoPainel";
import { LateralDoPainel } from "./LateralDoPainel";

/** O painel com o catálogo pronto: a lateral das escolhas e, ao lado, os números. */
export function Painel({
  geoserver,
  catalogo,
  estado,
  onEstadoChange,
}: {
  geoserver: GeoServerApi;
  catalogo: Catalogo;
  estado: EstadoPainel;
  onEstadoChange: (alteracao: AlteracaoPainel) => void;
}) {
  const painel = usePainel(geoserver, catalogo, estado);
  const { filtros, todosOsTipos } = painel;
  useRolarParaOAssunto(painel.carregando);
  return (
    // Como no mapa: as escolhas (lugar, filtros) numa lateral e os números ao lado; no
    // celular, as escolhas vêm antes, com os filtros recolhidos.
    <div className="lg:flex">
      <LateralDoPainel
        catalogo={catalogo}
        chave={painel.chave}
        dimensao={painel.dimensao?.dimensao}
        falhou={painel.erro !== null}
        filtros={filtros}
        geoserver={geoserver}
        linhas={painel.linhas}
        lugar={painel.lugar}
        nomes={painel.nomes}
        onAlternar={(dimensaoFiltro, valor) =>
          onEstadoChange(
            dimensaoFiltro === "categorias"
              ? alternarTipoDeArea(filtros, todosOsTipos, valor)
              : alternarNaUrl(filtros, dimensaoFiltro, valor),
          )
        }
        onEstadoChange={onEstadoChange}
        onLimpar={() => onEstadoChange(limparNaUrl(DIMENSOES_DO_PAINEL))}
        ranking={painel.ranking ?? []}
        total={painel.atual?.total}
      />

      <div className="min-w-0 flex-1 px-4 py-8 sm:px-6 lg:px-10">
        <div className="mx-auto max-w-5xl">
          <CabecalhoDoPainel
            buscaMapa={painel.buscaMapa}
            chave={painel.chave}
            lugar={painel.lugar}
            mapaSemLugar={painel.mapaSemLugar}
            nomes={painel.nomes}
            onVerBrasil={() => onEstadoChange({ dimensao: undefined, chave: undefined })}
          />
          <ConteudoDoPainel
            catalogo={catalogo}
            geoserver={geoserver}
            onEstadoChange={onEstadoChange}
            painel={painel}
          />
        </div>
      </div>
    </div>
  );
}
