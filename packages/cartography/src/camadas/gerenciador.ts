import type L from "leaflet";

import type { CamadaMapa } from "../tipos";
import { chaveDaCamada, criarCamada } from "./criar-camada";

/** O que o gerenciador avisa ao componente (lido na hora, para valer o retorno mais novo). */
export type RetornosDasCamadas = {
  onCarregando?: ((carregando: boolean) => void) | undefined;
  onErroCamada?: ((id: string) => void) | undefined;
};

type Gerenciada = {
  camada: L.TileLayer;
  /** O que, se mudar, exige uma camada nova (URL, limites, nome, presença de filtro). */
  chave: string;
  /** O filtro do WMS, que muda por `setParams` sem recriar a camada. */
  parametros: string;
  /** Camada anterior que continua visível até a nova terminar de carregar. */
  saindo?: L.TileLayer | undefined;
};

/** As camadas temáticas de um mapa: as que estão nele e o que carrega. */
export type GerenciadorDeCamadas = {
  /** Deixa no mapa só as camadas pedidas, na ordem pedida (a primeira fica por cima). */
  sincronizar: (camadas: readonly CamadaMapa[], urlWms: string) => void;
  /** Tira todas as camadas do mapa, com os eventos delas. */
  destruir: () => void;
};

/**
 * Cria o gerenciador das camadas temáticas de um mapa. As camadas vivem entre as renderizações
 * do componente: uma camada que continua igual é só ajustada (opacidade, ordem, filtro do WMS);
 * uma que muda de URL é trocada sem piscar (a anterior fica até a nova carregar os tiles da
 * vista); a que sai do pedido é tirada, com os eventos dela.
 */
export function criarGerenciadorDeCamadas(
  mapa: L.Map,
  retornos: () => RetornosDasCamadas,
): GerenciadorDeCamadas {
  const gerenciadas = new Map<string, Gerenciada>();
  const pendentes = new Set<string>();

  function marcarCarregamento(id: string, carregando: boolean) {
    const antes = pendentes.size > 0;
    if (carregando) pendentes.add(id);
    else pendentes.delete(id);
    const depois = pendentes.size > 0;
    if (antes !== depois) retornos().onCarregando?.(depois);
  }

  function tirar(gerenciada: Gerenciada) {
    for (const camada of [gerenciada.camada, gerenciada.saindo]) {
      // Primeiro sai do mapa: o Leaflet desliga os eventos de mapa da camada num ouvinte de
      // `remove` da própria camada. Só depois os ouvintes que sobraram (os nossos) saem.
      camada?.removeFrom(mapa);
      camada?.off();
    }
  }

  function sincronizar(camadas: readonly CamadaMapa[], urlWms: string) {
    const desejadas = new Set(camadas.map((c) => c.id));
    for (const [id, gerenciada] of gerenciadas) {
      if (!desejadas.has(id)) {
        tirar(gerenciada);
        gerenciadas.delete(id);
        marcarCarregamento(id, false);
      }
    }
    camadas.forEach((definicao, indice) => {
      const zIndex = 400 + camadas.length - indice;
      const opacidade = definicao.opacidade ?? 1;
      const chave = chaveDaCamada(definicao);
      const parametros = definicao.tipo === "wms" ? (definicao.cql ?? "") : "";
      const existente = gerenciadas.get(definicao.id);
      if (existente !== undefined && existente.chave === chave) {
        if (definicao.tipo === "wms" && existente.parametros !== parametros) {
          (existente.camada as L.TileLayer.WMS).setParams(
            (definicao.cql === undefined ? {} : { CQL_FILTER: definicao.cql }) as L.WMSParams,
          );
          existente.parametros = parametros;
        }
        existente.camada.setOpacity(opacidade);
        existente.camada.setZIndex(zIndex);
        return;
      }
      const camada = criarCamada(definicao, urlWms, { opacity: opacidade, zIndex });
      camada.on("loading", () => marcarCarregamento(definicao.id, true));
      camada.on("load", () => marcarCarregamento(definicao.id, false));
      camada.on("tileerror", () => retornos().onErroCamada?.(definicao.id));
      // Troca sem piscar (outro filtro, outra versão): a anterior fica até a nova carregar os
      // tiles da vista.
      existente?.saindo?.removeFrom(mapa);
      const saindo = existente?.camada;
      if (saindo !== undefined) {
        camada.once("load", () => {
          saindo.removeFrom(mapa);
          const atual = gerenciadas.get(definicao.id);
          if (atual?.saindo === saindo) atual.saindo = undefined;
        });
      }
      camada.addTo(mapa);
      // Fora da caixa da nova camada não há tile a carregar, e o `load` nunca viria.
      if (saindo !== undefined && !camada.isLoading()) saindo.removeFrom(mapa);
      gerenciadas.set(definicao.id, { camada, chave, parametros, saindo });
    });
  }

  function destruir() {
    for (const gerenciada of gerenciadas.values()) tirar(gerenciada);
    gerenciadas.clear();
    pendentes.clear();
  }

  return { sincronizar, destruir };
}
