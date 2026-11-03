import { LoadingState } from "@sinaveg/ui";

import type { GeoServerApi } from "@/shared/api/geoserver";
import { ErroCarregamento } from "@/shared/components/ErroCarregamento";
import { useCatalogo } from "@/shared/services/catalogo.queries";

import { Mapa } from "./components/Mapa";
import type { AlteracaoMapa, EstadoMapa } from "./types";

/** O mapa: espera o catálogo, que diz os anos, as camadas e os filtros possíveis. */
export function MapaScreen({
  geoserver,
  estado,
  onEstadoChange,
}: {
  geoserver: GeoServerApi;
  estado: EstadoMapa;
  onEstadoChange: (alteracao: AlteracaoMapa) => void;
}) {
  const catalogo = useCatalogo(geoserver);
  if (catalogo.isPending) {
    return <LoadingState>Carregando as camadas publicadas…</LoadingState>;
  }
  if (catalogo.isError) {
    return (
      <div className="p-6">
        <ErroCarregamento>
          Não foi possível ler o catálogo do GeoServer: {catalogo.error.message}
        </ErroCarregamento>
      </div>
    );
  }
  return (
    <Mapa
      catalogo={catalogo.data}
      estado={estado}
      geoserver={geoserver}
      onEstadoChange={onEstadoChange}
    />
  );
}
