import { useRef, useState } from "react";

import type { MapaWmsHandle } from "@sinaveg/cartography";

import {
  alternarNaUrl,
  alternarTipoDeArea,
  type DimensaoFiltro,
  DIMENSOES_FILTRO,
  limparNaUrl,
} from "@/modules/filtros";
import type { GeoServerApi } from "@/shared/api/geoserver";
import type { Catalogo } from "@/shared/services/catalogo.service";

import { useCamadasDoMapa } from "../hooks/useCamadasDoMapa";
import { useCliqueNoMapa } from "../hooks/useCliqueNoMapa";
import { useDestaque } from "../hooks/useDestaque";
import { useEstadoDoMapa } from "../hooks/useEstadoDoMapa";
import { useMunicipioEscolhido } from "../hooks/useMunicipioEscolhido";
import { useNumerosDoMapa } from "../hooks/useNumerosDoMapa";
import { useZoomAosEstados } from "../hooks/useZoomAosEstados";
import type { AlteracaoMapa, EstadoMapa } from "../types";
import { AreaDoMapa } from "./AreaDoMapa";
import { LateralDoMapa } from "./LateralDoMapa";

/**
 * O mapa com o catálogo pronto. Junta os hooks (o estado da URL, os números, o município, o
 * clique, o destaque e as camadas) e entrega cada parte à lateral e à área do mapa.
 */
export function Mapa({
  geoserver,
  catalogo,
  estado,
  onEstadoChange,
}: {
  geoserver: GeoServerApi;
  catalogo: Catalogo;
  estado: EstadoMapa;
  onEstadoChange: (alteracao: AlteracaoMapa) => void;
}) {
  const mapa = useRef<MapaWmsHandle>(null);
  // A lateral recolhida dá a largura toda ao mapa (só no computador).
  const [recolhida, setRecolhida] = useState(false);

  const estadoDoMapa = useEstadoDoMapa(catalogo, estado);
  const { filtros, ordemPadrao } = estadoDoMapa;
  const numeros = useNumerosDoMapa(geoserver, estadoDoMapa.ano, filtros);
  const municipio = useMunicipioEscolhido(geoserver, estado.municipio, estado.zoom, mapa);
  const clique = useCliqueNoMapa(geoserver, estadoDoMapa);
  const destaque = useDestaque(clique.identificacao, municipio.feicao);
  const camadas = useCamadasDoMapa(geoserver, catalogo, estadoDoMapa, estado.municipio);
  useZoomAosEstados(geoserver, filtros.estados, estado.zoom !== undefined, mapa);

  /** "Voltar ao padrão": sem filtros nem tipos marcados, na ordem padrão. */
  function voltarAoPadrao() {
    onEstadoChange({ ...limparNaUrl(DIMENSOES_FILTRO), ordem: undefined });
  }
  /** O "Limpar" do aviso sobre o mapa: tira os filtros e mantém os tipos marcados e a ordem. */
  function limparFiltros() {
    onEstadoChange(limparNaUrl(DIMENSOES_FILTRO.filter((dimensao) => dimensao !== "categorias")));
  }
  function alternar(dimensao: DimensaoFiltro, valor: string) {
    onEstadoChange(
      dimensao === "categorias"
        ? alternarTipoDeArea(filtros, ordemPadrao, valor, "nenhum")
        : alternarNaUrl(filtros, dimensao, valor),
    );
  }

  return (
    // No celular, o mapa vem primeiro na tela e os controles logo abaixo; no computador, os
    // controles ficam à esquerda.
    <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
      <LateralDoMapa
        catalogo={catalogo}
        estado={estadoDoMapa}
        geoserver={geoserver}
        municipio={municipio}
        municipioDaUrl={estado.municipio}
        numeros={numeros}
        onAlternar={alternar}
        onEstadoChange={onEstadoChange}
        onLimpar={voltarAoPadrao}
        onRecolher={setRecolhida}
        recolhida={recolhida}
      />
      <AreaDoMapa
        areasDosTipos={numeros.somas?.porLista.categorias}
        camadas={camadas}
        catalogo={catalogo}
        clique={clique}
        destaque={destaque}
        estado={estadoDoMapa}
        geoserver={geoserver}
        mapa={mapa}
        municipio={municipio}
        onEstadoChange={onEstadoChange}
        onLimpar={limparFiltros}
        vista={
          estado.longitude !== undefined &&
          estado.latitude !== undefined &&
          estado.zoom !== undefined
            ? { longitude: estado.longitude, latitude: estado.latitude, zoom: estado.zoom }
            : undefined
        }
      />
    </div>
  );
}
