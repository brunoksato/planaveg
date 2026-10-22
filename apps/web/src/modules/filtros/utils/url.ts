import type { Catalogo } from "@/shared/services/catalogo.service";
import { CONDICOES_DO_CADASTRO } from "@/shared/utils/glossario";

import { DIMENSOES_FILTRO, NENHUM_TIPO, type DimensaoFiltro, type FiltrosAreas } from "./filtros";
import type { FiltrosNaUrl } from "./filtros-na-url";
import { arranjosFiltraveis, temasFiltraveis } from "./opcoes";

/*
 * Os filtros das áreas na URL, com os mesmos nomes no mapa e no painel, para um link levar os
 * filtros de uma tela à outra.
 */

/** Os filtros da URL, só com valores que o catálogo conhece (estados e biomas, como vieram). */
export function filtrosDoEstado(
  estado: { readonly [K in keyof FiltrosNaUrl]?: string | undefined },
  catalogo: Catalogo,
): FiltrosAreas {
  return {
    categorias: tiposDaUrl(estado.categorias, catalogo),
    situacoes: valoresDaUrl(estado.situacoes, new Set(CONDICOES_DO_CADASTRO)),
    caminhos: valoresDaUrl(
      estado.caminhos,
      new Set(arranjosFiltraveis(catalogo.arranjos).map((a) => a.arranjo)),
    ),
    estados: valoresDaUrl(estado.estados),
    biomas: valoresDaUrl(estado.biomas),
    temas: valoresDaUrl(
      estado.temas,
      new Set(temasFiltraveis(catalogo.filtros).map((f) => f.filtro)),
    ),
  };
}

/** Os tipos de área da URL: os que o catálogo conhece, ou só `nenhum` (a pessoa tirou todos). */
function tiposDaUrl(texto: string | undefined, catalogo: Catalogo): string[] {
  const valores = valoresDaUrl(
    texto,
    new Set([...catalogo.niveis.map((n) => n.nivel), NENHUM_TIPO]),
  );
  return valores.includes(NENHUM_TIPO) ? [NENHUM_TIPO] : valores;
}

/** Os filtros de volta à URL, valores em ordem; só as `dimensoes` pedidas. */
export function filtrosParaUrl(
  filtros: FiltrosAreas,
  dimensoes: readonly DimensaoFiltro[] = DIMENSOES_FILTRO,
): FiltrosNaUrl {
  const url: FiltrosNaUrl = {};
  for (const dimensao of dimensoes) {
    if (filtros[dimensao].length > 0) url[dimensao] = filtros[dimensao].toSorted().join(",");
  }
  return url;
}

/** A mudança na URL ao marcar ou desmarcar um valor (sem nenhum, o filtro sai da URL). */
export function alternarNaUrl(
  filtros: FiltrosAreas,
  dimensao: DimensaoFiltro,
  valor: string,
): Partial<Record<DimensaoFiltro, string | undefined>> {
  const atuais = filtros[dimensao];
  const proximos = atuais.includes(valor) ? atuais.filter((v) => v !== valor) : [...atuais, valor];
  return { [dimensao]: proximos.length === 0 ? undefined : proximos.toSorted().join(",") };
}

/** A mudança na URL que tira todos os filtros das `dimensoes`. */
export function limparNaUrl(
  dimensoes: readonly DimensaoFiltro[],
): Partial<Record<DimensaoFiltro, undefined>> {
  return Object.fromEntries(dimensoes.map((dimensao) => [dimensao, undefined]));
}

/**
 * Marcar ou desmarcar um tipo de área. No painel, todos marcados são o padrão (fora da URL):
 * desmarcar um no padrão deixa os outros, e tirar todos guarda `nenhum`. No mapa, o padrão é
 * nenhum (fora da URL), para a pessoa escolher o que ver: os marcados vão sempre na URL, mesmo
 * todos.
 */
export function alternarTipoDeArea(
  filtros: FiltrosAreas,
  todos: readonly string[],
  valor: string,
  padrao: "todos" | "nenhum" = "todos",
): { categorias?: string | undefined } {
  const atuais = (
    filtros.categorias.length === 0 && padrao === "todos" ? todos : filtros.categorias
  ).filter((v) => v !== NENHUM_TIPO);
  const proximos = atuais.includes(valor) ? atuais.filter((v) => v !== valor) : [...atuais, valor];
  if (proximos.length === 0) return { categorias: padrao === "nenhum" ? undefined : NENHUM_TIPO };
  const marcados = new Set(proximos);
  const todosMarcados = todos.every((v) => marcados.has(v));
  return {
    categorias: todosMarcados && padrao === "todos" ? undefined : proximos.toSorted().join(","),
  };
}

/**
 * Os tipos de área de uma tela para a outra. No painel, nenhum na URL quer dizer todos; no
 * mapa, nenhum. Todos marcados no mapa (ou nenhum, o padrão dele) viram o padrão do painel, e o
 * padrão do painel vira todos os tipos, explícitos, no mapa.
 */
export function tiposParaOPainel(
  filtros: FiltrosAreas,
  todos: readonly string[],
): readonly string[] {
  const marcados = filtros.categorias.filter((v) => v !== NENHUM_TIPO);
  const conjunto = new Set(marcados);
  return marcados.length === 0 || todos.every((v) => conjunto.has(v)) ? [] : marcados;
}

export function tiposParaOMapa(filtros: FiltrosAreas, todos: readonly string[]): readonly string[] {
  return filtros.categorias.length === 0 ? todos : filtros.categorias;
}

/** Valores de um filtro na URL (separados por vírgula); com `validos`, só os conhecidos. */
function valoresDaUrl(texto: string | undefined, validos?: ReadonlySet<string>): string[] {
  const valores = (texto ?? "").split(",").filter((v) => v !== "");
  return validos === undefined ? valores : valores.filter((v) => validos.has(v));
}
