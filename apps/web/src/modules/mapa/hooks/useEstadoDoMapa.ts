import { useMemo } from "react";

import {
  cqlDosFiltros,
  filtrosDoEstado,
  NENHUM_TIPO,
  temFiltros,
  tiposDeArea,
  tiposParaOPainel,
} from "@/modules/filtros";
import type { Catalogo } from "@/shared/services/catalogo.service";

import type { EstadoMapa } from "../types";
import { OPACIDADE_PADRAO } from "../utils/constantes";
import { escreverOrdem, lerOrdem } from "../utils/legenda";

/**
 * O que o mapa mostra, lido da URL e do catálogo: os filtros e o CQL deles, a ordem e os tipos
 * da legenda, o mapa base e a intensidade. O ano é sempre o mais recente: o SINAVEG não compara
 * os anos (revisão da MMA de 16/10/2026). Só cálculo: as consultas e o estado da tela ficam nos
 * outros hooks.
 */
export function useEstadoDoMapa(catalogo: Catalogo, estado: EstadoMapa) {
  const { ano } = catalogo;
  const opacidade = (estado.opacidade ?? OPACIDADE_PADRAO) / 100;
  const mapaBase = estado.mapaBase ?? "claro";
  const { categorias, situacoes, caminhos, estados, biomas, temas } = estado;
  // Sem tipos na URL (ou só com códigos que a base não tem), nenhum: o mapa abre sem áreas, e a
  // pessoa escolhe o que ver.
  const filtros = useMemo(() => {
    const lidos = filtrosDoEstado(
      { categorias, situacoes, caminhos, estados, biomas, temas },
      catalogo,
    );
    return lidos.categorias.length === 0 ? { ...lidos, categorias: [NENHUM_TIPO] } : lidos;
  }, [catalogo, categorias, situacoes, caminhos, estados, biomas, temas]);
  const cqlDosTemas = useMemo(
    () => new Map(catalogo.filtros.map((f) => [f.filtro, f.cql])),
    [catalogo.filtros],
  );
  const cql = useMemo(() => cqlDosFiltros(filtros, cqlDosTemas), [cqlDosTemas, filtros]);

  // Os tipos de área são as camadas: nenhum marcado é o padrão; a ordem é a da legenda.
  const tipos = useMemo(() => tiposDeArea(catalogo), [catalogo]);
  const ordemPadrao = useMemo(() => tipos.map((t) => t.valor), [tipos]);
  const ordem = useMemo(() => lerOrdem(estado.ordem, ordemPadrao), [estado.ordem, ordemPadrao]);
  const ordemPropria = escreverOrdem(ordem, ordemPadrao) !== undefined;
  // Os filtros das áreas com os tipos como o painel os lê: nenhum tipo marcado (o padrão) ou
  // todos não filtram nada.
  const filtrosDasAreas = useMemo(
    () => ({ ...filtros, categorias: tiposParaOPainel(filtros, ordemPadrao) }),
    [filtros, ordemPadrao],
  );
  // O desenho das áreas na ordem padrão: todos os tipos marcados não filtram nada, e o mapa usa
  // os tiles prontos do cache (o desenho sem filtro).
  const cqlDasAreas = useMemo(
    () => cqlDosFiltros(filtrosDasAreas, cqlDosTemas),
    [cqlDosTemas, filtrosDasAreas],
  );
  const noMapa = useMemo(
    () => filtros.categorias.filter((c) => c !== NENHUM_TIPO),
    [filtros.categorias],
  );
  const camadasDaLegenda = useMemo(() => {
    const marcados = new Set(noMapa);
    return ordem.filter((c) => marcados.has(c));
  }, [noMapa, ordem]);
  // Filtrado é ver só parte das áreas: alguns tipos, ou um filtro de outra lista.
  const filtrado = temFiltros(filtrosDasAreas);
  // Um filtro das outras listas (estado, tema…): os tipos marcados são as camadas que a pessoa
  // escolheu ver, e o aviso de filtro sobre o mapa não conta com eles.
  const comFiltros = temFiltros({ ...filtros, categorias: [] });
  const foraDoPadrao = noMapa.length > 0 || filtrado || ordemPropria;
  const camadasPorNome = useMemo(
    () => new Map(catalogo.camadas.map((c) => [c.camada, c])),
    [catalogo.camadas],
  );

  return {
    ano,
    opacidade,
    mapaBase,
    filtros,
    filtrosDasAreas,
    cqlDosTemas,
    cql,
    cqlDasAreas,
    tipos,
    ordemPadrao,
    ordem,
    ordemPropria,
    noMapa,
    camadasDaLegenda,
    filtrado,
    comFiltros,
    foraDoPadrao,
    camadasPorNome,
    nomeCamadaPecas: `peca_${String(ano)}`,
  };
}

/** O que `useEstadoDoMapa` devolve. */
export type EstadoDoMapa = ReturnType<typeof useEstadoDoMapa>;
