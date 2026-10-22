import L from "leaflet";

import { nitida } from "./camadas/criar-camada";
import type { MapaBase } from "./tipos";

/**
 * Mapas base sem chave de API, um por chave de `CHAVES_DOS_MAPAS_BASE` (um novo entra nas duas).
 * `maxZoom` é o último nível com tiles próprios; acima dele o Leaflet amplia os do último nível.
 * (O CARTO Positron passou a exigir chave em 2026.)
 */
export const MAPAS_BASE: Record<
  MapaBase,
  { url: string; attribution: string; maxZoom: number; rotulo: string; temRotulos: boolean }
> = {
  ruas: {
    url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 19,
    rotulo: "OpenStreetMap",
    temRotulos: true,
  },
  claro: {
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}",
    attribution:
      'Tiles &copy; Esri &mdash; Esri, HERE, Garmin, &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 16,
    rotulo: "Esri Light Gray",
    temRotulos: false,
  },
  satelite: {
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution: "Tiles &copy; Esri e colaboradores",
    maxZoom: 19,
    rotulo: "Esri World Imagery",
    temRotulos: false,
  },
};

/** Põe o mapa base no mapa, por baixo de tudo; devolve como tirá-lo. */
export function colocarMapaBase(mapa: L.Map, mapaBase: MapaBase): () => void {
  const definicao = MAPAS_BASE[mapaBase];
  const base = L.tileLayer(definicao.url, {
    attribution: definicao.attribution,
    // Mapa com nomes escritos fica como está: no zoom seguinte, os nomes sairiam pela metade.
    ...(definicao.temRotulos
      ? { maxZoom: 18, maxNativeZoom: definicao.maxZoom }
      : nitida(definicao.maxZoom)),
    zIndex: 1,
  });
  base.addTo(mapa);
  return () => {
    base.removeFrom(mapa);
  };
}
