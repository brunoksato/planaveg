import type { QuantitativoFaceta } from "@sinaveg/web-contracts";

import { condicaoDaCategoria } from "@/shared/utils/glossario";

import { COLUNA, DIMENSOES_FILTRO, type DimensaoFiltro, type FiltrosAreas } from "./filtros";

/*
 * As facetas somadas no navegador. Cada linha de `quantitativo_faceta` (ou de
 * `quantitativo_faceta_lugar`) é uma combinação de atributos, com a área e os polígonos dela, e
 * cada peça cai numa linha só. Somar as linhas que atendem os filtros dá os números das listas de
 * filtro, do mapa e do painel, sem outro pedido ao GeoServer.
 */

/** Uma linha das facetas com as listas (temas, esferas e tipos de UC) já separadas. */
export type LinhaFaceta = Omit<QuantitativoFaceta, "temas" | "esferas_uc" | "tipos_uc"> & {
  temas: readonly string[];
  esferas_uc: readonly string[];
  tipos_uc: readonly string[];
};

/**
 * Área e polígonos somados. Cada peça junta os polígonos de mesmos atributos no município e na
 * bacia, e o mapa e o painel contam os polígonos, que é o que se vê.
 */
export type Total = { area: number; poligonos: number };

export function prepararFacetas(linhas: readonly QuantitativoFaceta[]): LinhaFaceta[] {
  return linhas.map((linha) => ({
    ...linha,
    temas: lista(linha.temas),
    esferas_uc: lista(linha.esferas_uc),
    tipos_uc: lista(linha.tipos_uc),
  }));
}

/** "a,b" → ["a", "b"]; "" → []. */
function lista(texto: string): string[] {
  return texto === "" ? [] : texto.split(",");
}

/** O valor da linha numa dimensão (os temas têm vários; a situação é a condição do cadastro). */
function valoresDaLinha(linha: LinhaFaceta, dimensao: DimensaoFiltro): readonly string[] {
  if (dimensao === "temas") return linha.temas;
  const valor = linha[COLUNA[dimensao]];
  if (valor === null) return [];
  if (dimensao !== "situacoes") return [valor];
  const condicao = condicaoDaCategoria(valor);
  return condicao === undefined ? [] : [condicao];
}

/** Os valores escolhidos de cada dimensão, em conjuntos: a busca é constante em cada linha. */
type Escolhidos = Readonly<Record<DimensaoFiltro, ReadonlySet<string>>>;

function escolhidosDe(filtros: FiltrosAreas): Escolhidos {
  return {
    categorias: new Set(filtros.categorias),
    situacoes: new Set(filtros.situacoes),
    caminhos: new Set(filtros.caminhos),
    estados: new Set(filtros.estados),
    biomas: new Set(filtros.biomas),
    temas: new Set(filtros.temas),
  };
}

/** A linha atende todas as dimensões filtradas, menos `ignorar`. */
function atende(linha: LinhaFaceta, escolhidos: Escolhidos, ignorar?: DimensaoFiltro): boolean {
  return DIMENSOES_FILTRO.every((dimensao) => {
    const valores = escolhidos[dimensao];
    if (dimensao === ignorar || valores.size === 0) return true;
    return valoresDaLinha(linha, dimensao).some((valor) => valores.has(valor));
  });
}

function zerado(): Total {
  return { area: 0, poligonos: 0 };
}

/** Soma a linha ao total. */
function acumular(total: Total, linha: LinhaFaceta) {
  total.area += linha.area_ha;
  total.poligonos += linha.n_poligonos;
}

/** Área e polígonos que atendem todos os filtros. */
export function totalFiltrado(linhas: readonly LinhaFaceta[], filtros: FiltrosAreas): Total {
  const total = zerado();
  const escolhidos = escolhidosDe(filtros);
  for (const linha of linhas) {
    if (atende(linha, escolhidos)) acumular(total, linha);
  }
  return total;
}

/**
 * Para uma dimensão, a área de cada valor com os filtros das outras dimensões aplicados, e não
 * os dela (em cascata): é quanto sobra se o valor for escolhido.
 */
export function totaisPorValor(
  linhas: readonly LinhaFaceta[],
  filtros: FiltrosAreas,
  dimensao: DimensaoFiltro,
): Map<string, Total> {
  const totais = new Map<string, Total>();
  const escolhidos = escolhidosDe(filtros);
  for (const linha of linhas) {
    if (!atende(linha, escolhidos, dimensao)) continue;
    for (const valor of valoresDaLinha(linha, dimensao)) somarTotal(totais, valor, linha);
  }
  return totais;
}

/** A área de cada valor de cada lista de filtro (`totaisPorValor` de cada dimensão). */
export type TotaisDasListas = Partial<Record<DimensaoFiltro, ReadonlyMap<string, Total>>>;

/** `totaisPorValor` das `dimensoes`, de uma vez: o que as listas de filtro mostram. */
export function totaisDasListas(
  linhas: readonly LinhaFaceta[],
  filtros: FiltrosAreas,
  dimensoes: readonly DimensaoFiltro[],
): TotaisDasListas {
  return Object.fromEntries(
    dimensoes.map((dimensao) => [dimensao, totaisPorValor(linhas, filtros, dimensao)]),
  );
}

/**
 * Os processos dos projetos de recuperação (Anexo 2 do relatório), na ordem que decide a área
 * que tem mais de um.
 */
export const PROCESSOS = ["embargo", "reparacao", "licenciamento", "outros"] as const;
export type Processo = (typeof PROCESSOS)[number];

/**
 * O processo de uma área de projeto, pela categoria dela: o Recooperar (e o MonitoRAD) pelo
 * próprio processo, na ordem embargo, reparação de danos, licenciamento; o resto (PRADA,
 * Projetos de Cooperação MMA, Observatório) como outros.
 */
function processoDoProjeto(nivel: string, temas: readonly string[]): Processo {
  if (nivel === "recooperar" || nivel === "monitorad") {
    if (temas.includes("embargo_recooperar")) return "embargo";
    if (temas.includes("reparacao_danos")) return "reparacao";
    if (temas.includes("licenciamento")) return "licenciamento";
  }
  return "outros";
}

/** Os números de um lugar num ano, só das áreas que atendem os filtros. */
export type Resumo = {
  total: Total;
  porNivel: Map<string, number>;
  porArranjo: Map<string, number>;
  /** As áreas dos níveis de projeto, pelo processo que as originou. */
  porProcesso: Map<Processo, number>;
  /** Nível → condição do cadastro → área (só APP, AUR e RL têm condição). */
  porCondicao: Map<string, Map<string, number>>;
  porBioma: Map<string, Total>;
  porUf: Map<string, Total>;
  /**
   * As áreas dentro de Unidades de Conservação (qualquer tipo de área), por esfera e por tipo.
   * Cada área entra numa esfera e num tipo só: a área em UCs de mais de uma esfera fica em
   * `MAIS_DE_UMA`, e a sem esfera, em `SEM_ESFERA`. Assim as duas divisões somam `ucs`.
   */
  ucs: Total;
  porEsferaUc: Map<string, Total>;
  porTipoUc: Map<string, Total>;
};

/** A área em UCs de mais de uma esfera, ou de mais de um tipo. */
export const MAIS_DE_UMA = "mais_de_uma";

/** A área em UC sem esfera no arquivo. */
export const SEM_ESFERA = "sem_esfera";

/** A esfera ou o tipo de UC de uma área: o único que ela tem, `MAIS_DE_UMA` ou nada. */
function unica(valores: readonly string[]): string | undefined {
  return valores.length > 1 ? MAIS_DE_UMA : valores[0];
}

/**
 * Soma as linhas que atendem todos os filtros por cada assunto do painel. Ao contrário das
 * listas de filtro (`totaisPorValor`), nenhuma dimensão é ignorada: tudo responde pelas áreas
 * filtradas. `niveisDeProjeto` diz quais níveis são de projeto, para o resumo por processo.
 */
export function resumir(
  linhas: readonly LinhaFaceta[],
  filtros: FiltrosAreas,
  niveisDeProjeto: ReadonlySet<string> = new Set(),
): Resumo {
  const resumo: Resumo = {
    total: zerado(),
    porNivel: new Map(),
    porArranjo: new Map(),
    porProcesso: new Map(),
    porCondicao: new Map(),
    porBioma: new Map(),
    porUf: new Map(),
    ucs: zerado(),
    porEsferaUc: new Map(),
    porTipoUc: new Map(),
  };
  const escolhidos = escolhidosDe(filtros);
  for (const linha of linhas) {
    if (!atende(linha, escolhidos)) continue;
    const area = linha.area_ha;
    acumular(resumo.total, linha);
    if (linha.nivel !== null) somar(resumo.porNivel, linha.nivel, area);
    if (linha.nivel !== null && niveisDeProjeto.has(linha.nivel)) {
      somar(resumo.porProcesso, processoDoProjeto(linha.nivel, linha.temas), area);
    }
    if (linha.arranjo !== null) somar(resumo.porArranjo, linha.arranjo, area);
    const condicao = linha.categoria === null ? undefined : condicaoDaCategoria(linha.categoria);
    if (linha.nivel !== null && condicao !== undefined) {
      const condicoes = resumo.porCondicao.get(linha.nivel) ?? new Map<string, number>();
      somar(condicoes, condicao, area);
      resumo.porCondicao.set(linha.nivel, condicoes);
    }
    if (linha.bioma !== null) somarTotal(resumo.porBioma, linha.bioma, linha);
    if (linha.uf !== null) somarTotal(resumo.porUf, linha.uf, linha);
    const tipoUc = unica(linha.tipos_uc);
    if (tipoUc !== undefined) {
      acumular(resumo.ucs, linha);
      somarTotal(resumo.porTipoUc, tipoUc, linha);
      somarTotal(resumo.porEsferaUc, unica(linha.esferas_uc) ?? SEM_ESFERA, linha);
    }
  }
  return resumo;
}

function somar<K>(mapa: Map<K, number>, chave: K, valor: number) {
  mapa.set(chave, (mapa.get(chave) ?? 0) + valor);
}

function somarTotal(mapa: Map<string, Total>, chave: string, linha: LinhaFaceta) {
  const total = mapa.get(chave) ?? zerado();
  acumular(total, linha);
  mapa.set(chave, total);
}
