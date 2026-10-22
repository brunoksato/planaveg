import { queryOptions, useQuery } from "@tanstack/react-query";

import type { GeoServerApi } from "@/shared/api/geoserver";

import { MEIA_HORA } from "./cache";
import { buscarCatalogo } from "./catalogo.service";

export function catalogoQuery(api: GeoServerApi) {
  return queryOptions({
    queryKey: ["catalogo"],
    staleTime: MEIA_HORA,
    queryFn: ({ signal }) => buscarCatalogo(api, signal),
  });
}

export function useCatalogo(api: GeoServerApi) {
  return useQuery(catalogoQuery(api));
}

/**
 * A versão dos dados das consultas, que o catálogo define. `pronta`: o catálogo já respondeu
 * (com sucesso ou erro); até lá, as consultas de dados esperam, para irem com `v=` na URL e
 * ficarem em cache na CDN. Com o catálogo fora do ar, seguem sem versão. `versao` vai também na
 * chave de cada consulta: quando uma base nova entra no meio da visita e o catálogo é relido com
 * outra versão, todas as consultas trocam junto com ele, e catálogo e dados nunca discordam.
 */
function useVersaoDosDados(api: GeoServerApi): {
  pronta: boolean;
  versao: string | undefined;
} {
  const catalogo = useCatalogo(api);
  return { pronta: catalogo.isFetched, versao: catalogo.data?.versao };
}

/**
 * Uma consulta de dados do GeoServer: espera o catálogo (`pronta` no `enabled`, junto com
 * `habilitada`), leva a versão dos dados na chave, logo depois do primeiro item (a tabela), e
 * fica fresca por meia hora. `chave` é o resto da chave: a tabela e o que distingue a consulta.
 */
export function useDados<T>(
  api: GeoServerApi,
  chave: readonly [string, ...unknown[]],
  buscar: (signal: AbortSignal) => Promise<T>,
  habilitada = true,
) {
  const { pronta, versao } = useVersaoDosDados(api);
  const [tabela, ...resto] = chave;
  return useQuery({
    queryKey: [tabela, versao, ...resto],
    enabled: pronta && habilitada,
    staleTime: MEIA_HORA,
    queryFn: ({ signal }) => buscar(signal),
  });
}
