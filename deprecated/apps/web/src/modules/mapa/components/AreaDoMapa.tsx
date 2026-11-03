import { useState, type RefObject } from "react";

import { MapaWms, type CamadaMapa, type Destaque, type MapaWmsHandle } from "@sinaveg/cartography";

import type { Total } from "@/modules/filtros";
import type { GeoServerApi } from "@/shared/api/geoserver";
import type { Catalogo } from "@/shared/services/catalogo.service";

import type { CliqueNoMapa } from "../hooks/useCliqueNoMapa";
import type { EstadoDoMapa } from "../hooks/useEstadoDoMapa";
import type { MunicipioEscolhido } from "../hooks/useMunicipioEscolhido";
import type { AlteracaoMapa } from "../types";
import { AvisoDeCarregamento } from "./AvisoDeCarregamento";
import { AvisosDoTopo } from "./AvisosDoTopo";
import { ControlesDoMapa } from "./ControlesDoMapa";
import { LegendaDoMapa } from "./LegendaDoMapa";
import { PainelDoClique } from "./PainelDoClique";

/** O mapa com o que fica sobre ele: controles, avisos, legenda e o painel do clique. */
export function AreaDoMapa({
  geoserver,
  catalogo,
  mapa,
  camadas,
  destaque,
  estado,
  vista,
  areasDosTipos,
  municipio,
  clique,
  onLimpar,
  onEstadoChange,
}: {
  geoserver: GeoServerApi;
  catalogo: Catalogo;
  mapa: RefObject<MapaWmsHandle | null>;
  camadas: CamadaMapa[];
  destaque: Destaque | null;
  estado: EstadoDoMapa;
  /** A vista da URL (centro e zoom), quando ela tem uma. */
  vista: { longitude: number; latitude: number; zoom: number } | undefined;
  /** A área de cada tipo com os filtros, para a legenda; `undefined` antes das facetas. */
  areasDosTipos: ReadonlyMap<string, Total> | undefined;
  municipio: MunicipioEscolhido;
  clique: CliqueNoMapa;
  /** O "Limpar" do aviso de filtro: tira os filtros, mantém os tipos marcados. */
  onLimpar: () => void;
  onEstadoChange: (alteracao: AlteracaoMapa) => void;
}) {
  const [carregando, setCarregando] = useState(false);
  // Algum tile não veio: o aviso fica até o mapa voltar a carregar (um movimento, outro filtro).
  const [falhou, setFalhou] = useState(false);
  return (
    // `isolate`: os z-index do Leaflet (400 a 1000) ficam dentro do mapa e não cobrem o menu do
    // cabeçalho no celular.
    <div className="relative isolate order-first min-h-[65svh] flex-1 lg:order-none lg:min-h-0">
      <MapaWms
        camadas={camadas}
        className="absolute inset-0"
        destaque={destaque}
        mapaBase={estado.mapaBase}
        onCarregando={(agora) => {
          setCarregando(agora);
          if (agora) setFalhou(false);
        }}
        onClique={(evento) => void clique.identificar(evento)}
        onErroCamada={() => setFalhou(true)}
        onVista={(novaVista) => onEstadoChange(novaVista)}
        ref={mapa}
        urlWms={geoserver.urlWms}
        vista={vista}
      />
      <ControlesDoMapa
        mapa={mapa}
        mapaBase={estado.mapaBase}
        onEstadoChange={onEstadoChange}
        onIrAoMunicipio={() => municipio.irPara(municipio.feicao)}
        opacidade={estado.opacidade}
        temMunicipio={municipio.feicao !== undefined}
      />
      {carregando || falhou ? (
        <AvisoDeCarregamento falhou={!carregando} filtrado={estado.filtrado} />
      ) : null}
      <AvisosDoTopo filtrado={estado.comFiltros} onLimpar={onLimpar} />
      <div className="absolute bottom-9 left-3 z-[1000]">
        <LegendaDoMapa areas={areasDosTipos} estado={estado} onEstadoChange={onEstadoChange} />
      </div>
      <PainelDoClique catalogo={catalogo} clique={clique} />
    </div>
  );
}
