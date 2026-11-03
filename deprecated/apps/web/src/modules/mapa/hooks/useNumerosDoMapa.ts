import { useMemo } from "react";

import {
  DIMENSOES_FILTRO,
  type FiltrosAreas,
  NENHUM_TIPO,
  prepararFacetas,
  SEM_FILTROS,
  totaisDasListas,
  totaisPorValor,
  totalFiltrado,
  useFacetas,
} from "@/modules/filtros";
import type { GeoServerApi } from "@/shared/api/geoserver";

/**
 * Os números da lateral e da legenda, das facetas do ano: a área de cada opção dos filtros, a
 * do que está no mapa e os estados e biomas do ano. As somas passam pelas milhares de linhas das
 * facetas: saem uma vez por filtro, e mover o mapa, que refaz a tela, não as refaz.
 */
export function useNumerosDoMapa(
  geoserver: GeoServerApi,
  ano: number | undefined,
  filtros: FiltrosAreas,
) {
  const facetas = useFacetas(geoserver, ano);
  const linhas = useMemo(
    () => (facetas.data === undefined ? undefined : prepararFacetas(facetas.data)),
    [facetas.data],
  );
  // Todos os estados e biomas do ano, mesmo os que os filtros zeram: as listas não mudam.
  const lugares = useMemo(
    () => ({
      estados: [...totaisPorValor(linhas ?? [], SEM_FILTROS, "estados").keys()],
      biomas: [...totaisPorValor(linhas ?? [], SEM_FILTROS, "biomas").keys()],
    }),
    [linhas],
  );
  const somas = useMemo(() => {
    if (linhas === undefined) return undefined;
    // Sem tipo marcado (o padrão), as listas contam as áreas de todos os tipos: dá para escolher
    // o estado antes do tipo, e o mapa vai até ele.
    const daContagem = filtros.categorias.includes(NENHUM_TIPO)
      ? { ...filtros, categorias: [] }
      : filtros;
    return {
      /** As áreas que atendem todos os filtros: o que está no mapa. */
      total: totalFiltrado(linhas, filtros),
      /**
       * A área que sobra em cada opção de cada lista, com os filtros das outras. A dos tipos é
       * também a da legenda: a lista dos tipos não conta o filtro dos tipos.
       */
      porLista: totaisDasListas(linhas, daContagem, DIMENSOES_FILTRO),
    };
  }, [linhas, filtros]);
  return { facetas, lugares, somas };
}

/** O que `useNumerosDoMapa` devolve. */
export type NumerosDoMapa = ReturnType<typeof useNumerosDoMapa>;
