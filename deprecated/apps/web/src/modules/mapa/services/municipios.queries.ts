import type { GeoServerApi } from "@/shared/api/geoserver";
import { useDados } from "@/shared/services/catalogo.queries";
import { termoDeBusca } from "@/shared/utils/textos";

import { buscarMunicipio, buscarMunicipiosPorNome } from "./municipios.service";

/** O município escolhido (pelo código na URL). */
export function useMunicipioPorCodigo(api: GeoServerApi, codigo: string | undefined) {
  return useDados(
    api,
    ["municipio", codigo],
    (signal) => buscarMunicipio(api, codigo ?? "", signal),
    codigo !== undefined,
  );
}

/**
 * As sugestões da busca de município, a partir de dois caracteres. A chave leva o termo como a
 * busca o compara ("São" e "sao " dão a mesma consulta).
 */
export function useSugestoesDeMunicipio(api: GeoServerApi, consulta: string) {
  const termo = termoDeBusca(consulta);
  return useDados(
    api,
    ["municipio", "busca", termo],
    (signal) => buscarMunicipiosPorNome(api, termo, signal),
    termo.length >= 2,
  );
}
