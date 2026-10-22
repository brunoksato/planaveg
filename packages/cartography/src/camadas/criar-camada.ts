import L from "leaflet";

import { comEsperaDeZoom, type GradeComEspera } from "../espera-zoom";
import type { CamadaMapa } from "../tipos";

/**
 * Opções de grade das camadas temáticas: não pede tiles dos zooms intermediários durante a
 * animação de zoom (eles chegariam tarde e seriam descartados) e guarda mais tiles em volta da
 * vista, para voltar ao arrastar sem pedir de novo.
 */
const GRADE: L.GridLayerOptions = { updateWhenZooming: false, keepBuffer: 4 };

/**
 * Nitidez em tela de alta densidade (celular, MacBook): os tiles do zoom seguinte, mostrados na
 * metade do tamanho, em vez de tiles do zoom da vista esticados ao dobro. São os mesmos tiles
 * do cache que uma tela comum usa no zoom seguinte. O Leaflet tira um do `maxZoom` ao ligar a
 * opção; o `maxNativeZoom` (em zoom do mapa) fica um abaixo do último nível do servidor.
 */
export function nitida(ultimoNivel?: number): L.TileLayerOptions {
  if (!L.Browser.retina) {
    return { maxZoom: 18, ...(ultimoNivel === undefined ? {} : { maxNativeZoom: ultimoNivel }) };
  }
  return {
    detectRetina: true,
    maxZoom: 19,
    ...(ultimoNivel === undefined ? {} : { maxNativeZoom: ultimoNivel - 1 }),
  };
}

// Os tiles prontos esperam o zoom assentar (ver `espera-zoom.ts`); o WMS do contorno, nunca.
// `_update` é interno da GridLayer do Leaflet 1.9.4 (versão fixada no package.json): se uma
// versão nova o remover, o mapa falha aqui, na carga, e não em silêncio.
const ATUALIZAR = "_update";
const atualizarGrade = (L.GridLayer.prototype as unknown as Record<string, unknown>)[ATUALIZAR];
if (typeof atualizarGrade !== "function") {
  throw new Error("Leaflet sem GridLayer._update: revise a espera de zoom (espera-zoom.ts).");
}
const TileLayerComEspera = L.TileLayer.extend({
  [ATUALIZAR]: comEsperaDeZoom(atualizarGrade as (this: GradeComEspera) => void),
}) as unknown as typeof L.TileLayer;

/** O que, se mudar, exige uma camada nova (URL, limites, nome, presença de filtro). */
export function chaveDaCamada(definicao: CamadaMapa): string {
  if (definicao.tipo === "tiles") {
    return `tiles|${definicao.url}|${definicao.limites?.join(",") ?? ""}`;
  }
  return `wms|${definicao.nome}|${definicao.cql === undefined ? "" : "cql"}|${definicao.versao ?? ""}`;
}

/** A camada do Leaflet de uma definição: tiles prontos ou WMS desenhado na hora. */
export function criarCamada(
  definicao: CamadaMapa,
  urlWms: string,
  base: { opacity: number; zIndex: number },
): L.TileLayer {
  if (definicao.tipo === "tiles") {
    const [oeste, sul, leste, norte] = definicao.limites ?? [];
    return new TileLayerComEspera(definicao.url, {
      ...GRADE,
      ...base,
      ...nitida(),
      // Opção nossa, lida pela espera de zoom; o Leaflet guarda as opções que não conhece.
      ...({ esperarDesdeZoom: definicao.esperarDesdeZoom } as object),
      ...(oeste === undefined || sul === undefined || leste === undefined || norte === undefined
        ? {}
        : {
            bounds: L.latLngBounds([sul, oeste], [norte, leste]),
          }),
    });
  }
  return L.tileLayer.wms(urlWms, {
    ...GRADE,
    ...base,
    layers: definicao.nome,
    styles: "",
    format: "image/png",
    transparent: true,
    version: "1.1.1",
    // No WMS, a opção pede a imagem com o dobro de pixels para o mesmo pedaço do mapa.
    detectRetina: L.Browser.retina,
    maxZoom: 18,
    // Parâmetros extras viram parâmetros do GetMap.
    ...(definicao.cql === undefined ? {} : ({ CQL_FILTER: definicao.cql } as object)),
    ...(definicao.versao === undefined ? {} : ({ v: definicao.versao } as object)),
  });
}
