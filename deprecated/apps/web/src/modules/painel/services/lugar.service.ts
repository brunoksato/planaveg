import type { QuantitativoDimensao, QuantitativoFacetaLugar } from "@sinaveg/web-contracts";

import { cqlDaBusca, textoCql } from "@/shared/api/cql";
import type { GeoServerApi } from "@/shared/api/geoserver";

/*
 * As consultas do painel sobre um lugar (estado, município, bacia, região hidrográfica, bioma).
 * `quantitativo_dimensao` e `quantitativo_faceta_lugar` são sempre consultadas com filtro.
 */

/** Um lugar na lista e no gráfico: só o que eles mostram. O painel conta polígonos, como o mapa. */
export type ValorRanking = Pick<
  QuantitativoDimensao,
  "chave" | "rotulo" | "area_ha" | "n_poligonos"
>;

/** O total de cada lugar em `quantitativo_dimensao`: as linhas sem recorte por nível ou arranjo. */
const TOTAL_DO_LUGAR = "nivel IS NULL AND arranjo IS NULL";

/** As colunas das facetas de um lugar (sem `dimensao` e `chave`, que já se sabe). */
const COLUNAS_FACETA = [
  "ano_vs",
  "nivel",
  "categoria",
  "arranjo",
  "uf",
  "bioma",
  "temas",
  "esferas_uc",
  "tipos_uc",
  "n_pecas",
  "n_poligonos",
  "area_ha",
] as const satisfies ReadonlyArray<keyof QuantitativoFacetaLugar>;

/** Totais de cada valor de uma dimensão num ano (UF, município, bacia, bioma…). */
export function buscarRanking(
  api: GeoServerApi,
  dimensao: string,
  ano: number | undefined,
  signal?: AbortSignal,
): Promise<ValorRanking[]> {
  // Municípios são ~5 mil linhas: só as quatro colunas usadas, para a resposta ficar leve.
  return api.linhas<ValorRanking>("quantitativo_dimensao", {
    cql: `dimensao = ${textoCql(dimensao)} AND ano_vs = ${String(ano)} AND ${TOTAL_DO_LUGAR}`,
    propriedades: ["chave", "rotulo", "area_ha", "n_poligonos"],
    ordenarPor: "area_ha DESC",
    signal,
  });
}

/** As facetas de um lugar num ano: no máximo uns mil, no maior bioma. */
export function buscarFacetasDoLugar(
  api: GeoServerApi,
  dimensao: string | undefined,
  chave: string | undefined,
  ano: number,
  signal?: AbortSignal,
): Promise<Array<Pick<QuantitativoFacetaLugar, (typeof COLUNAS_FACETA)[number]>>> {
  return api.linhas<Pick<QuantitativoFacetaLugar, (typeof COLUNAS_FACETA)[number]>>(
    "quantitativo_faceta_lugar",
    {
      cql: `dimensao = ${textoCql(dimensao ?? "")} AND chave = ${textoCql(chave ?? "")} AND ano_vs = ${String(ano)}`,
      propriedades: COLUNAS_FACETA,
      signal,
    },
  );
}

/** O nome de um lugar, mesmo sem área no ano escolhido (as facetas não trazem nomes). */
export async function buscarNomeDoLugar(
  api: GeoServerApi,
  dimensao: string | undefined,
  chave: string | undefined,
  signal?: AbortSignal,
): Promise<string | null> {
  const [linha] = await api.linhas<Pick<QuantitativoDimensao, "rotulo">>("quantitativo_dimensao", {
    cql: `dimensao = ${textoCql(dimensao ?? "")} AND chave = ${textoCql(chave ?? "")} AND ${TOTAL_DO_LUGAR}`,
    propriedades: ["rotulo"],
    limite: 1,
    signal,
  });
  return linha?.rotulo ?? null;
}

/** Quantos lugares a busca traz; com tantos, a lista diz que há mais. */
export const LIMITE_DA_BUSCA = 40;

/**
 * Os lugares de uma dimensão cujo nome tem o termo (a busca de municípios e bacias), já sem
 * acento e sem curinga (`termoDeBusca`), contra a coluna `busca` (o rótulo em minúsculas e sem
 * acento).
 */
export function buscarLugaresPorNome(
  api: GeoServerApi,
  dimensao: string,
  termo: string,
  signal?: AbortSignal,
): Promise<Array<Pick<QuantitativoDimensao, "chave" | "rotulo">>> {
  return api.linhas<Pick<QuantitativoDimensao, "chave" | "rotulo">>("quantitativo_dimensao", {
    cql: `dimensao = ${textoCql(dimensao)} AND ${TOTAL_DO_LUGAR} AND ${cqlDaBusca(termo)}`,
    propriedades: ["chave", "rotulo"],
    limite: LIMITE_DA_BUSCA,
    signal,
  });
}
