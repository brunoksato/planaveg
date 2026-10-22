import type { AtributosPeca } from "@sinaveg/web-contracts";

/** A intensidade das cores das áreas, em %, quando a URL não diz outra. */
export const OPACIDADE_PADRAO = 80;

/**
 * Primeiro zoom de tiles fora do cache semeado das peças (`planaveg-core semear`: até o 11, um
 * acima do mapa, para a tela de alta densidade, que pede o zoom seguinte). A partir dele o mapa
 * espera o zoom assentar para pedir tiles, e zooms rápidos não fazem o servidor desenhar os
 * níveis atravessados. Áreas filtradas esperam em todo zoom: só os filtros comuns e os mais
 * pedidos estão no cache, e só até o zoom 8.
 */
export const FORA_DO_CACHE = 12;

/**
 * Os atributos que o clique mostra de uma peça (e o CSV). Sem a geometria: a de uma peça grande
 * passa de 5 MB, e o contorno só a usa quando o clique não acha o polígono; aí ela é pedida à
 * parte (`geometriaDaPeca`).
 */
export const PROPRIEDADES_PECA = [
  "fid",
  "ano_vs",
  "origem_id",
  "nivel",
  "categoria",
  "arranjo",
  "hierarquia",
  "area_ha",
  "uf",
  "municipio",
  "bioma",
  "bacia",
  "sobreposicao",
  "licenciamento",
  "reparacao_danos",
  "embargo",
  "outras_areas",
  "observatorio",
  "gef_terrestre",
  "restauracao_ecologica",
  "uc_federal",
  "uc_estadual",
  "uc_municipal",
  "apa",
  "rppn",
  "uc",
] as const satisfies ReadonlyArray<keyof AtributosPeca>;

/**
 * Os atributos das áreas no CSV do mapa: os do clique, sem o `origem_id`, que só serve para achar
 * os polígonos da peça (o `fid` já o traz), e com a situação do cadastro da planilha de
 * nomenclatura no lugar das condições do CAR como a base as nomeia (`categoria` e o rótulo
 * `hierarquia`), que o clique usa só para achar o nome.
 */
export const ATRIBUTOS_CSV: ReadonlyArray<keyof AtributosPeca> = PROPRIEDADES_PECA.flatMap((p) => {
  if (p === "origem_id" || p === "hierarquia") return [];
  return p === "categoria" ? ["situacao_cadastro" as const] : [p];
});

/**
 * O que o clique pede do polígono clicado (`peca_parte`): a área dele, quantos a peça tem e a
 * geometria inteira, para o contorno.
 */
export const PROPRIEDADES_PARTE = ["parte", "partes", "area_ha", "geom"] as const;
