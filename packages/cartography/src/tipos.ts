import type { GeoJsonObject } from "geojson";
import type { Ref } from "react";

import type { ConsultaClique } from "./consulta-clique";

/*
 * Os tipos do mapa do portal: o mapa base, as camadas (tiles prontos ou WMS na hora), a vista, o
 * clique e o que o portal pode pedir ao mapa (`MapaWmsHandle`).
 */

/**
 * Os mapas base, na ordem da escolha do fundo: a lista que o schema da URL do mapa aceita. Cada um
 * é definido em `MAPAS_BASE` (`mapas-base.ts`), que tem de ter exatamente estes (o tipo confere).
 * Mora aqui, sem o Leaflet, para o schema, que fica no bundle principal, importá-la barato.
 */
export const CHAVES_DOS_MAPAS_BASE = ["ruas", "claro", "satelite"] as const;

export type MapaBase = (typeof CHAVES_DOS_MAPAS_BASE)[number];

/** Feição a destacar, em GeoJSON longitude/latitude. */
export type Destaque = GeoJsonObject;

/** [oeste, sul, leste, norte] em graus (EPSG:4674 ≈ EPSG:4326 na escala do mapa). */
export type Caixa = readonly [number, number, number, number];

/** Tiles prontos (WMTS do cache do GeoServer): o caminho rápido, sem desenho por pedido. */
type CamadaTiles = {
  /** Chave estável da camada no portal. */
  id: string;
  tipo: "tiles";
  /** Modelo de URL com `{z}`, `{y}` e `{x}`. Mudar a URL troca a camada sem piscar. */
  url: string;
  opacidade?: number | undefined;
  /** Só pede tiles dentro desta caixa (a extensão dos dados da camada). */
  limites?: Caixa | undefined;
  /**
   * Primeiro zoom fora do cache semeado: a partir dele, a camada espera o zoom assentar antes
   * de pedir tiles (ver `espera-zoom.ts`). Sem ele, pede como o Leaflet.
   */
  esperarDesdeZoom?: number | undefined;
};

/** Desenho na hora pelo WMS (o contorno do município): sem cache de tiles. */
type CamadaWms = {
  /** Chave estável da camada no portal. */
  id: string;
  tipo: "wms";
  /** Nome qualificado no GeoServer (`workspace:camada`). */
  nome: string;
  opacidade?: number | undefined;
  /** Filtro ECQL (`CQL_FILTER`); muda a camada sem recriá-la. */
  cql?: string | undefined;
  /** A versão dos dados (`v=` no GetMap): a imagem fica em cache na CDN sem ficar velha. */
  versao?: string | undefined;
};

export type CamadaMapa = CamadaTiles | CamadaWms;

/** O centro e o zoom do mapa. */
export type Vista = { longitude: number; latitude: number; zoom: number };

export type CliqueMapa = {
  /** Parâmetros do `GetFeatureInfo` para este clique, no Web Mercator da tela (EPSG:3857). */
  consulta: ConsultaClique;
};

export type MapaWmsHandle = {
  ajustarAosLimites: (caixa: Caixa) => void;
  redefinirVista: () => void;
  aproximar: () => void;
  afastar: () => void;
};

export type MapaWmsProps = {
  urlWms: string;
  /** A primeira camada fica por cima. */
  camadas: readonly CamadaMapa[];
  mapaBase: MapaBase;
  vista?: Vista | undefined;
  /** Feição a destacar (GeoJSON em longitude/latitude), ou null. */
  destaque?: Destaque | null | undefined;
  onVista?: ((vista: Vista) => void) | undefined;
  onClique?: ((clique: CliqueMapa) => void) | undefined;
  onCarregando?: ((carregando: boolean) => void) | undefined;
  onErroCamada?: ((id: string) => void) | undefined;
  className?: string | undefined;
  ref?: Ref<MapaWmsHandle> | undefined;
};
