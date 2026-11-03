import type * as z from "zod/mini";

import type { AtributosPeca, PartePeca } from "@sinaveg/web-contracts";

import type { Geometria } from "@/shared/api/geoserver";

import type { parametrosDoMapa } from "./parametros";

/** O estado do mapa na URL, como o schema o lê: cada campo é opcional (sem ele, o padrão). */
export type EstadoMapa = z.output<typeof parametrosDoMapa>;

/** Uma alteração do estado: os campos que mudam; `undefined` volta o campo ao padrão. */
export type AlteracaoMapa = EstadoMapa;

/** O polígono clicado de uma peça, com a área dele e a geometria inteira, para o contorno. */
export type PoligonoClicado = Pick<PartePeca, "parte" | "partes" | "area_ha"> & {
  geometria: Geometria | null;
};

/**
 * O clique no mapa: as peças que estão no ponto, cada uma com o polígono clicado (`null` quando
 * não veio: o painel mostra então só a peça) e, sem ele, a geometria simplificada da peça inteira
 * para o contorno. `consultando`: a resposta ainda não veio; `erro`: o GeoServer não respondeu
 * (não é o mesmo que nenhuma peça ali).
 */
export type Identificacao = {
  consultando: boolean;
  erro?: string | undefined;
  pecas: Array<AtributosPeca & { geometria: Geometria | null; poligono: PoligonoClicado | null }>;
};
