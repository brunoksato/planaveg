import type {
  CatalogoAno,
  CatalogoArranjo,
  CatalogoCamada,
  CatalogoDimensao,
  CatalogoFiltro,
  CatalogoNivel,
  FonteAusente,
  FonteVigente,
} from "@sinaveg/web-contracts";

import type { GeoServerApi } from "@/shared/api/geoserver";

/**
 * O catálogo descreve o que existe (anos, camadas, hierarquia, arranjos, filtros e dimensões) e
 * de onde vem a base. Todas as telas o leem; é ele também que define a versão dos dados.
 */
export type Catalogo = {
  anos: CatalogoAno[];
  /**
   * O ano de VS mais recente da base, o único que o portal mostra: o SINAVEG não compara os anos
   * (revisão da MMA de 16/10/2026). Sem anos no catálogo, nenhum.
   */
  ano: number | undefined;
  camadas: CatalogoCamada[];
  niveis: CatalogoNivel[];
  arranjos: CatalogoArranjo[];
  filtros: CatalogoFiltro[];
  dimensoes: CatalogoDimensao[];
  ausentes: FonteAusente[];
  fonte: FonteVigente | null;
  /**
   * A versão dos dados com que o catálogo foi lido, a mesma que o cliente põe em `v=` nas
   * consultas seguintes e que vai na chave de cada uma; sem ela (a base em atualização), nada.
   */
  versao: string | undefined;
};

const TABELAS_DO_CATALOGO = [
  "catalogo_ano",
  "catalogo_camada",
  "catalogo_nivel",
  "catalogo_arranjo",
  "catalogo_filtro",
  "catalogo_dimensao",
  "fonte_ausente",
  "fonte_vigente",
] as const;

/** Ordena por uma coluna numérica, mantendo a ordem do servidor nos empates. */
function ordenar<T>(linhas: readonly T[] | undefined, coluna: keyof T): T[] {
  return (linhas ?? []).toSorted((a, b) => Number(a[coluna]) - Number(b[coluna]));
}

/**
 * Primeiro a versão dos dados, numa consulta mínima e sem versão (um minuto na CDN, para uma base
 * nova aparecer logo); depois as oito tabelas num pedido só, já com ela, como todas as outras
 * consultas: tudo fica em cache na CDN sem nunca ficar velho.
 */
export async function buscarCatalogo(api: GeoServerApi, signal?: AbortSignal): Promise<Catalogo> {
  const [vigente] = await api
    .linhas<Pick<FonteVigente, "versao_dados">>("fonte_vigente", {
      propriedades: ["versao_dados"],
      semVersao: true,
      signal,
    })
    .catch(() => []);
  const versao = vigente?.versao_dados ?? undefined;
  api.definirVersaoDosDados(versao);
  const tabelas = await api.tabelas(TABELAS_DO_CATALOGO, { signal, versao });
  const fonte = ((tabelas.fonte_vigente ?? [])[0] as FonteVigente | undefined) ?? null;
  const anos = ordenar(tabelas.catalogo_ano as CatalogoAno[], "ano_vs");
  return {
    anos,
    // Em ordem crescente: o último é o mais recente.
    ano: anos.at(-1)?.ano_vs,
    camadas: ordenar(tabelas.catalogo_camada as CatalogoCamada[], "ordem"),
    niveis: ordenar(tabelas.catalogo_nivel as CatalogoNivel[], "tier"),
    arranjos: ordenar(tabelas.catalogo_arranjo as CatalogoArranjo[], "prioridade"),
    filtros: ordenar(tabelas.catalogo_filtro as CatalogoFiltro[], "ordem"),
    dimensoes: ordenar(tabelas.catalogo_dimensao as CatalogoDimensao[], "ordem"),
    ausentes: (tabelas.fonte_ausente ?? []) as FonteAusente[],
    fonte,
    versao,
  };
}
