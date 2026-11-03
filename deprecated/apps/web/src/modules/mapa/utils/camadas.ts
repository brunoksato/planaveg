import type { Caixa, CamadaMapa } from "@sinaveg/cartography";
import type { CatalogoCamada } from "@sinaveg/web-contracts";

import { cqlDosFiltros, type FiltrosAreas } from "@/modules/filtros";
import type { GeoServerApi } from "@/shared/api/geoserver";

import { FORA_DO_CACHE } from "./constantes";
import { cqlDoMunicipio } from "./cql";

/** Extensão publicada da camada (`catalogo_camada`), para o mapa só pedir tiles dentro dela. */
function limitesDaCamada(camada: CatalogoCamada | undefined): Caixa | undefined {
  if (camada === undefined) return undefined;
  const { minx, miny, maxx, maxy } = camada;
  if (minx === null || miny === null || maxx === null || maxy === null) return undefined;
  return [minx, miny, maxx, maxy];
}

/** O que decide as camadas do mapa. */
export type EntradaDasCamadas = {
  geoserver: GeoServerApi;
  filtros: FiltrosAreas;
  /** O CQL das áreas numa camada só: sem o filtro de tipo quando todos estão marcados. */
  cqlDasAreas: string | undefined;
  /** O CQL de cada tema do relatório (`catalogo_filtro`). */
  cqlDosTemas: ReadonlyMap<string, string>;
  /** Os tipos de área no mapa, na ordem da legenda. */
  camadasDaLegenda: readonly string[];
  /** A legenda está noutra ordem que não a da hierarquia. */
  ordemPropria: boolean;
  nomeCamadaPecas: string;
  /** De 0 a 1. */
  opacidade: number;
  municipio: string | undefined;
  camadasPorNome: ReadonlyMap<string, CatalogoCamada>;
  /**
   * As versões publicadas: vão na URL, então um tile guardado pelo navegador nunca sobrevive a
   * uma republicação. Sem versão (a base em atualização), os tiles vão sem ela, e nenhuma fica
   * no lugar da outra: um tile com versão fica um ano em cache.
   */
  versaoMapa: string | undefined;
  versaoDados: string | undefined;
};

/**
 * As camadas do mapa, de cima para baixo. As peças vêm prontas do cache de tiles (com filtro, o
 * cache guarda cada filtro à parte); só o contorno do município (CQL) é desenhado na hora.
 */
export function montarCamadas(entrada: EntradaDasCamadas): CamadaMapa[] {
  const tiles = (
    id: string,
    nome: string,
    estilo: string,
    filtro: string | undefined,
  ): CamadaMapa => ({
    id,
    tipo: "tiles",
    url: entrada.geoserver.urlTiles(nome, estilo, entrada.versaoMapa, filtro),
    opacidade: entrada.opacidade,
    limites: limitesDaCamada(entrada.camadasPorNome.get(nome)),
    esperarDesdeZoom: filtro === undefined ? FORA_DO_CACHE : 0,
  });
  const lista: CamadaMapa[] = [];
  if (entrada.municipio !== undefined) {
    lista.push({
      id: "municipio",
      tipo: "wms",
      nome: entrada.geoserver.camada("municipio"),
      cql: cqlDoMunicipio(entrada.municipio),
      versao: entrada.versaoDados,
    });
  }
  // Sem nenhum tipo marcado, o mapa fica só com o fundo (e o município, se houver).
  if (entrada.camadasDaLegenda.length === 0) return lista;
  if (!entrada.ordemPropria) {
    // Na ordem padrão, uma camada só, do cache: o estilo já desenha os tipos nessa ordem.
    lista.push(tiles("pecas", entrada.nomeCamadaPecas, "planaveg_nivel", entrada.cqlDasAreas));
    return lista;
  }
  // Noutra ordem, uma camada por tipo, na ordem da legenda (a primeira fica por cima).
  for (const tipo of entrada.camadasDaLegenda) {
    const filtro = cqlDosFiltros({ ...entrada.filtros, categorias: [tipo] }, entrada.cqlDosTemas);
    lista.push(tiles(`tipo:${tipo}`, entrada.nomeCamadaPecas, "planaveg_nivel", filtro));
  }
  return lista;
}
