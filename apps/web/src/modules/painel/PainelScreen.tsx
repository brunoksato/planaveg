import { LoadingState } from "@sinaveg/ui";

import type { GeoServerApi } from "@/shared/api/geoserver";
import { ErroCarregamento } from "@/shared/components/ErroCarregamento";
import { useCatalogo } from "@/shared/services/catalogo.queries";

import { Painel } from "./components/Painel";
import type { AlteracaoPainel, EstadoPainel } from "./types";

/** O painel: espera o catálogo, que diz os anos, os lugares e os filtros possíveis. */
export function PainelScreen({
  geoserver,
  estado,
  onEstadoChange,
}: {
  geoserver: GeoServerApi;
  estado: EstadoPainel;
  onEstadoChange: (alteracao: AlteracaoPainel) => void;
}) {
  const catalogo = useCatalogo(geoserver);
  if (catalogo.isPending) return <LoadingState>Carregando o painel…</LoadingState>;
  if (catalogo.isError) {
    return (
      <ErroCarregamento>
        Não foi possível ler o catálogo do GeoServer: {catalogo.error.message}
      </ErroCarregamento>
    );
  }
  return (
    <Painel
      catalogo={catalogo.data}
      estado={estado}
      geoserver={geoserver}
      onEstadoChange={onEstadoChange}
    />
  );
}
