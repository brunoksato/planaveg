import type { GeoServerApi } from "@/shared/api/geoserver";
import { useDados } from "@/shared/services/catalogo.queries";
import { termoDeBusca } from "@/shared/utils/textos";

import {
  buscarFacetasDoLugar,
  buscarLugaresPorNome,
  buscarNomeDoLugar,
  buscarRanking,
} from "./lugar.service";

/** Totais de cada valor de uma dimensão num ano (UF, município, bacia, bioma…). */
export function useRanking(api: GeoServerApi, dimensao: string, ano: number | undefined) {
  return useDados(
    api,
    ["quantitativo_dimensao", "ranking", dimensao, ano],
    (signal) => buscarRanking(api, dimensao, ano, signal),
    ano !== undefined,
  );
}

/** As facetas de um lugar num ano. */
export function useFacetasDoLugar(
  api: GeoServerApi,
  dimensao: string | undefined,
  chave: string | undefined,
  ano: number,
) {
  return useDados(
    api,
    ["quantitativo_faceta_lugar", dimensao, chave, ano],
    (signal) => buscarFacetasDoLugar(api, dimensao, chave, ano, signal),
    dimensao !== undefined && chave !== undefined,
  );
}

/** O nome de um lugar, mesmo sem área no ano escolhido. */
export function useNomeDoLugar(
  api: GeoServerApi,
  dimensao: string | undefined,
  chave: string | undefined,
) {
  return useDados(
    api,
    ["quantitativo_dimensao", "nome", dimensao, chave],
    (signal) => buscarNomeDoLugar(api, dimensao, chave, signal),
    dimensao !== undefined && chave !== undefined,
  );
}

/**
 * A busca de lugares pelo nome, só quando a lista é grande demais para vir inteira (`remota`) e
 * a partir de dois caracteres. A chave leva o termo como a busca o compara.
 */
export function useBuscaDeLugar(
  api: GeoServerApi,
  dimensao: string,
  consulta: string,
  remota: boolean,
) {
  const termo = termoDeBusca(consulta);
  return useDados(
    api,
    ["quantitativo_dimensao", "busca", dimensao, termo],
    (signal) => buscarLugaresPorNome(api, dimensao, termo, signal),
    remota && termo.length >= 2,
  );
}
