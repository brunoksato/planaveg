import L from "leaflet";

import type { Destaque } from "./tipos";

/**
 * O destaque é só contorno: um traço escuro sobre um halo branco, que aparece em qualquer fundo
 * (claro ou satélite) sem pintar a área por dentro. Preenchido, ele mudava a cor da área (o roxo
 * virava rosa sob o amarelo), e ela deixava de bater com a legenda.
 */
const ESTILO_HALO: L.PathOptions = { color: "#ffffff", weight: 6, opacity: 0.9, fill: false };
const ESTILO_DESTAQUE: L.PathOptions = { color: "#12211b", weight: 2.5, opacity: 1, fill: false };

/** Contorna a feição no mapa; devolve como tirar o contorno. */
export function desenharDestaque(mapa: L.Map, destaque: Destaque): () => void {
  const halo = L.geoJSON(destaque, { style: () => ESTILO_HALO, interactive: false });
  const linha = L.geoJSON(destaque, { style: () => ESTILO_DESTAQUE, interactive: false });
  halo.addTo(mapa);
  linha.addTo(mapa);
  return () => {
    halo.removeFrom(mapa);
    linha.removeFrom(mapa);
  };
}
