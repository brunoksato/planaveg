import type { Caixa } from "@sinaveg/cartography";
import type { MunicipioBusca } from "@sinaveg/web-contracts";

import { cqlDaBusca, textoCql } from "@/shared/api/cql";
import type { Feicao, GeoServerApi } from "@/shared/api/geoserver";

import { cqlDoMunicipio } from "../utils/cql";
import { caixaDaGeometria, unirCaixas } from "../utils/geometria";

/** Quantos municípios a busca sugere; com tantos, a lista diz que há mais. */
export const LIMITE_DE_SUGESTOES = 8;

/**
 * Um município pelo código do IBGE, com a geometria (para o mapa ir até ele e contorná-lo); um
 * código que não existe dá `null` (o TanStack Query não aceita `undefined` como resposta).
 */
export async function buscarMunicipio(
  api: GeoServerApi,
  codigo: string,
  signal?: AbortSignal,
): Promise<Feicao<MunicipioBusca> | null> {
  const [feicao] = await api.feicoes<MunicipioBusca>("municipio", {
    cql: cqlDoMunicipio(codigo),
    limite: 1,
    signal,
  });
  return feicao ?? null;
}

/**
 * Os municípios cujo nome tem o termo, em ordem alfabética: já sem acento e sem curinga
 * (`termoDeBusca`), contra a coluna `busca` (o rótulo em minúsculas e sem acento), para "sao"
 * achar "São Paulo".
 */
export function buscarMunicipiosPorNome(
  api: GeoServerApi,
  termo: string,
  signal?: AbortSignal,
): Promise<Feicao<MunicipioBusca>[]> {
  return api.feicoes<MunicipioBusca>("municipio", {
    cql: cqlDaBusca(termo),
    ordenarPor: "rotulo",
    limite: LIMITE_DE_SUGESTOES,
    signal,
  });
}

/**
 * A caixa que junta os retângulos dos municípios de um ou mais estados (a `uf` do município é a
 * do código do IBGE; o retângulo, o das peças dele), para o mapa ir até os estados escolhidos;
 * sem município, nada.
 */
export async function buscarLimitesDosEstados(
  api: GeoServerApi,
  ufs: readonly string[],
  signal?: AbortSignal,
): Promise<Caixa | undefined> {
  const feicoes = await api.feicoes<Pick<MunicipioBusca, "uf">>("municipio", {
    cql: `uf IN (${ufs.map(textoCql).join(", ")})`,
    propriedades: ["uf", "geom"],
    signal,
  });
  return unirCaixas(feicoes.map((f) => caixaDaGeometria(f.geometria)));
}
