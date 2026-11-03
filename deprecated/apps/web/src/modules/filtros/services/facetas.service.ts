import type { QuantitativoFaceta } from "@sinaveg/web-contracts";

import type { GeoServerApi } from "@/shared/api/geoserver";

/**
 * As facetas das peças de um ano no Brasil (cerca de 4,7 mil linhas na base nacional): somadas
 * no navegador, dão os números de qualquer filtro, no mapa e no painel.
 */
export function buscarFacetas(
  api: GeoServerApi,
  ano: number | undefined,
  signal?: AbortSignal,
): Promise<QuantitativoFaceta[]> {
  return api.linhas<QuantitativoFaceta>("quantitativo_faceta", {
    cql: `ano_vs = ${String(ano)}`,
    signal,
  });
}
