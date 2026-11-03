import { useMemo } from "react";

import {
  descreverFiltros,
  DIMENSOES_DO_PAINEL,
  type FiltrosAreas,
  filtrosDoEstado,
  filtrosParaUrl,
  type LinhaFaceta,
  prepararFacetas,
  resumir,
  SEM_FILTROS,
  temFiltros,
  tiposDeArea,
  tiposParaOMapa,
  useFacetas,
} from "@/modules/filtros";
import type { GeoServerApi } from "@/shared/api/geoserver";
import type { Catalogo } from "@/shared/services/catalogo.service";
import { niveisDoCriterio } from "@/shared/utils/criterios";
import { nomeDimensao, nomeLugar } from "@/shared/utils/glossario";

import { useFacetasDoLugar, useNomeDoLugar, useRanking } from "../services/lugar.queries";
import type { ContextoCsv, EstadoPainel } from "../types";
import { semAcento } from "../utils/csv";

/** Os lugares que o mapa sabe mostrar, e o filtro do mapa que mostra cada um. */
const LUGAR_NO_MAPA: Readonly<Record<string, "estados" | "biomas" | "municipio">> = {
  uf: "estados",
  bioma: "biomas",
  municipio: "municipio",
};

/**
 * Tudo o que o painel mostra, a partir do estado da URL: o lugar, os filtros, as facetas do ano
 * (do Brasil ou do lugar) e os resumos somados delas, o nome do lugar e o link para o mesmo
 * lugar no mapa. O painel mostra só a base mais recente: o SINAVEG não compara os anos (revisão
 * da MMA de 16/10/2026).
 */
export function usePainel(geoserver: GeoServerApi, catalogo: Catalogo, estado: EstadoPainel) {
  const ano = catalogo.ano ?? 0;
  const { dimensao, chave, nomes } = lugarEscolhido(catalogo, estado);
  const { filtros, filtrando, todosOsTipos } = useFiltros(catalogo, estado);
  const numeros = useNumeros(geoserver, catalogo, {
    dimensao: dimensao?.dimensao,
    chave,
    ano,
    filtros,
    filtrando,
  });
  const { ranking, lugar } = useLugar(geoserver, dimensao?.dimensao, chave, ano);
  const contexto: ContextoCsv = {
    ano,
    lugar,
    filtros: descreverFiltros(filtros, catalogo),
    arquivo: `${semAcento(lugar)}${filtrando ? "-filtrado" : ""}`,
  };
  return {
    dimensao,
    chave,
    nomes,
    filtros,
    filtrando,
    todosOsTipos,
    brasil: chave === undefined,
    ranking,
    ...numeros,
    lugar,
    ...linkParaOMapa(filtros, todosOsTipos, dimensao?.dimensao, chave),
    contexto,
  };
}

/** O que `usePainel` devolve: o estado derivado de tudo o que o painel mostra. */
export type DadosDoPainel = ReturnType<typeof usePainel>;

/** O lugar da URL: uma dimensão do catálogo e a chave nela. Sem dimensão, o Brasil inteiro. */
function lugarEscolhido(catalogo: Catalogo, estado: EstadoPainel) {
  const dimensao = catalogo.dimensoes.find((d) => d.dimensao === estado.dimensao);
  if (dimensao === undefined) return { dimensao, chave: undefined, nomes: undefined };
  return {
    dimensao,
    chave: estado.chave,
    nomes: nomeDimensao(dimensao.dimensao, dimensao.titulo),
  };
}

/** Os filtros do painel e os tipos de área do catálogo. */
function useFiltros(catalogo: Catalogo, estado: EstadoPainel) {
  // Só os filtros do painel: estado e bioma são lugar, não filtro.
  const { categorias, situacoes, caminhos, temas } = estado;
  const filtros = useMemo(
    () => filtrosDoEstado({ categorias, situacoes, caminhos, temas }, catalogo),
    [catalogo, categorias, situacoes, caminhos, temas],
  );
  // Todos os tipos de área marcados é o padrão, à vista na lista (como no mapa).
  const todosOsTipos = useMemo(() => tiposDeArea(catalogo).map((t) => t.valor), [catalogo]);
  return { filtros, filtrando: temFiltros(filtros), todosOsTipos };
}

/**
 * Os números: as facetas do ano e os resumos somados delas, com os filtros e, se há filtro, sem
 * eles. No Brasil (ou escolhendo um lugar), as facetas do Brasil, as mesmas do mapa; num lugar,
 * as dele.
 */
function useNumeros(
  geoserver: GeoServerApi,
  catalogo: Catalogo,
  {
    dimensao,
    chave,
    ano,
    filtros,
    filtrando,
  }: {
    dimensao: string | undefined;
    chave: string | undefined;
    ano: number;
    filtros: FiltrosAreas;
    filtrando: boolean;
  },
) {
  const brasil = chave === undefined;
  const nacional = useFacetas(geoserver, brasil ? ano : undefined);
  const doLugar = useFacetasDoLugar(geoserver, dimensao, chave, ano);
  const facetas = brasil ? nacional : doLugar;
  const linhas = useMemo(
    (): LinhaFaceta[] | undefined =>
      facetas.data === undefined ? undefined : prepararFacetas(facetas.data),
    [facetas.data],
  );
  // Os níveis de projeto (Recooperar, Observatório…), para separar os projetos por processo.
  const niveisDeProjeto = useMemo(
    () => new Set(niveisDoCriterio(catalogo.niveis, "intencionalidade").map((n) => n.nivel)),
    [catalogo.niveis],
  );
  const atual = useMemo(
    () => (linhas === undefined ? undefined : resumir(linhas, filtros, niveisDeProjeto)),
    [linhas, filtros, niveisDeProjeto],
  );
  const semFiltro = useMemo(
    () => (!filtrando || linhas === undefined ? undefined : resumir(linhas, SEM_FILTROS)),
    [filtrando, linhas],
  );
  return { linhas, atual, semFiltro, carregando: facetas.isPending, erro: facetas.error ?? null };
}

/** A lista dos lugares da dimensão (o ranking) e o nome do lugar escolhido. */
function useLugar(
  geoserver: GeoServerApi,
  dimensao: string | undefined,
  chave: string | undefined,
  ano: number,
) {
  const ranking = useRanking(geoserver, dimensao ?? "", dimensao === undefined ? undefined : ano);
  const nomeDoLugar = useNomeDoLugar(geoserver, dimensao, chave);
  const rotulo = ranking.data?.find((r) => r.chave === chave)?.rotulo ?? nomeDoLugar.data ?? null;
  const lugar =
    dimensao === undefined || chave === undefined ? "Brasil" : nomeLugar(dimensao, chave, rotulo);
  return { ranking: ranking.data, lugar };
}

/**
 * O mesmo lugar e os mesmos filtros no mapa. O mapa abre sem tipos marcados: o link leva os do
 * painel, todos se ele não filtra. Bacias e regiões não têm contorno no mapa (`mapaSemLugar`).
 */
function linkParaOMapa(
  filtros: FiltrosAreas,
  todosOsTipos: readonly string[],
  dimensao: string | undefined,
  chave: string | undefined,
) {
  const noMapa = dimensao === undefined ? undefined : LUGAR_NO_MAPA[dimensao];
  const buscaMapa = {
    ...filtrosParaUrl(
      { ...filtros, categorias: tiposParaOMapa(filtros, todosOsTipos) },
      DIMENSOES_DO_PAINEL,
    ),
    ...(chave === undefined || noMapa === undefined ? {} : { [noMapa]: chave }),
  };
  return { buscaMapa, mapaSemLugar: chave !== undefined && noMapa === undefined };
}
