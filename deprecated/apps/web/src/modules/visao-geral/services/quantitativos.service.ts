import type { QuantitativoArranjo, QuantitativoNivel } from "@sinaveg/web-contracts";

import type { GeoServerApi } from "@/shared/api/geoserver";

/** A área de cada nível da hierarquia em cada ano, na ordem dos anos e da hierarquia. */
export function buscarQuantitativoNivel(
  api: GeoServerApi,
  signal?: AbortSignal,
): Promise<QuantitativoNivel[]> {
  return api.linhas<QuantitativoNivel>("quantitativo_nivel", {
    ordenarPor: "ano_vs,tier,categoria",
    signal,
  });
}

/** O total de cada arranjo em cada ano (`nivel` nulo), na ordem dos anos e da prioridade. */
export function buscarQuantitativoArranjo(
  api: GeoServerApi,
  signal?: AbortSignal,
): Promise<QuantitativoArranjo[]> {
  return api.linhas<QuantitativoArranjo>("quantitativo_arranjo", {
    cql: "nivel IS NULL",
    ordenarPor: "ano_vs,prioridade",
    signal,
  });
}
