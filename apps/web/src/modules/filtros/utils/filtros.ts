import type { QuantitativoFaceta } from "@sinaveg/web-contracts";

/**
 * Os filtros das áreas, no mapa e no painel: em cada dimensão, os valores escolhidos (nenhum =
 * todos). Dentro de uma dimensão vale qualquer um dos valores (OU); entre dimensões, todas (E).
 * As mesmas regras valem para as contagens e os números do painel (somados no navegador a partir
 * de `quantitativo_faceta` e `quantitativo_faceta_lugar`) e para o mapa, o clique e o download
 * (CQL no GeoServer).
 */
export type FiltrosAreas = {
  /** Níveis da hierarquia (`nivel`). */
  categorias: readonly string[];
  /**
   * Condição do cadastro no CAR (`em_conformidade`, `nao_analisado`), que junta as `categoria`
   * da base: só os níveis de APP, AUR e RL a têm.
   */
  situacoes: readonly string[];
  /** Arranjos de implementação (`arranjo`). */
  caminhos: readonly string[];
  /** UFs (`uf`). */
  estados: readonly string[];
  biomas: readonly string[];
  /** Filtros do relatório, pelo código (o CQL de cada um vem de `catalogo_filtro`). */
  temas: readonly string[];
};

export type DimensaoFiltro = keyof FiltrosAreas;

export const DIMENSOES_FILTRO: readonly DimensaoFiltro[] = [
  "categorias",
  "situacoes",
  "caminhos",
  "estados",
  "biomas",
  "temas",
];

/**
 * Nenhum tipo de área marcado (`categorias=nenhum`): sem `categorias`, são todos. Vira
 * `nivel IN ('nenhum')`, que não tem área, então números, CSV e clique ficam vazios sozinhos.
 */
export const NENHUM_TIPO = "nenhum";

export const SEM_FILTROS: FiltrosAreas = {
  categorias: [],
  situacoes: [],
  caminhos: [],
  estados: [],
  biomas: [],
  temas: [],
};

/** A coluna de cada dimensão nas peças e nas facetas (os temas vêm à parte). */
export const COLUNA = {
  categorias: "nivel",
  situacoes: "categoria",
  caminhos: "arranjo",
  estados: "uf",
  biomas: "bioma",
} as const satisfies Record<Exclude<DimensaoFiltro, "temas">, keyof QuantitativoFaceta>;

/** As dimensões que o painel filtra: o estado e o bioma são escolhidos como lugar. */
export const DIMENSOES_DO_PAINEL = ["categorias", "situacoes", "caminhos", "temas"] as const;

export function temFiltros(filtros: FiltrosAreas): boolean {
  return DIMENSOES_FILTRO.some((dimensao) => filtros[dimensao].length > 0);
}
