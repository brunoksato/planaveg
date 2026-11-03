import { describe, expect, it } from "vitest";

import { consultaDoClique, type ConsultaClique } from "./consulta-clique";

type LatLng = { lat: number; lng: number };

/** O Web Mercator do Leaflet (`L.CRS.EPSG3857`), refeito aqui: o Leaflet só carrega com o DOM. */
const RAIO = 6_378_137;
const RAD = Math.PI / 180;
const webMercator = {
  project: ({ lat, lng }: LatLng) => ({
    x: RAIO * lng * RAD,
    y: RAIO * Math.log(Math.tan(Math.PI / 4 + (lat * RAD) / 2)),
  }),
  unproject: ({ x, y }: { x: number; y: number }): LatLng => ({
    lat: (2 * Math.atan(Math.exp(y / RAIO)) - Math.PI / 2) / RAD,
    lng: x / RAIO / RAD,
  }),
};

/**
 * Uma vista como a do Leaflet: o centro, o zoom e o tamanho em pixels. Devolve o mapa (só o que a
 * conta usa) e o ponto de cada pixel, o `latlng` que o Leaflet dá no evento de clique.
 */
function vista(centro: LatLng, zoom: number, largura: number, altura: number) {
  const metrosPorPixel = (2 * Math.PI * RAIO) / (256 * 2 ** zoom);
  const meio = webMercator.project(centro);
  const oeste = meio.x - (largura / 2) * metrosPorPixel;
  const norte = meio.y + (altura / 2) * metrosPorPixel;
  const noPixel = (x: number, y: number) =>
    webMercator.unproject({ x: oeste + x * metrosPorPixel, y: norte - y * metrosPorPixel });
  const mapa = {
    getBounds: () => ({
      getSouthWest: () => noPixel(0, altura),
      getNorthEast: () => noPixel(largura, 0),
    }),
    getSize: () => ({ x: largura, y: altura }),
  };
  return { mapa, noPixel };
}

/** O ponto que o GeoServer consulta: o pixel interpolado em linha reta entre as bordas da caixa. */
function consultado({ bbox: [oeste, sul, leste, norte], largura, altura, x, y }: ConsultaClique) {
  return webMercator.unproject({
    x: oeste + ((leste - oeste) * x) / largura,
    y: norte - ((norte - sul) * y) / altura,
  });
}

describe("consultaDoClique", () => {
  it("faz o GeoServer consultar o ponto clicado, do Brasil inteiro ao zoom de rua", () => {
    const vistas = [
      // A vista inicial do portal num mapa de 664 × 712 px, onde o desvio era o maior.
      vista({ lat: -14.5, lng: -54 }, 4, 664, 712),
      vista({ lat: -17.06, lng: -56.69 }, 8, 1280, 720),
      vista({ lat: -3.2, lng: -52.2 }, 15, 390, 844),
    ];
    for (const { mapa, noPixel } of vistas) {
      const { x: largura, y: altura } = mapa.getSize();
      for (const [x, y] of [
        [0, 0],
        [largura / 2, altura / 2],
        [largura * 0.45, altura * 0.54],
        [largura, altura],
      ] as const) {
        const ponto = consultado(consultaDoClique(mapa, webMercator, { x, y }));
        expect(ponto.lat).toBeCloseTo(noPixel(x, y).lat, 8);
        expect(ponto.lng).toBeCloseTo(noPixel(x, y).lng, 8);
      }
    }
  });

  it("manda a caixa da vista em metros, o tamanho do mapa e o pixel clicado", () => {
    const { mapa, noPixel } = vista({ lat: -14.5, lng: -54 }, 4, 664, 712);

    const consulta = consultaDoClique(mapa, webMercator, { x: 301, y: 386 });

    const sudoeste = webMercator.project(noPixel(0, 712));
    const nordeste = webMercator.project(noPixel(664, 0));
    expect(consulta).toEqual({
      bbox: [sudoeste.x, sudoeste.y, nordeste.x, nordeste.y],
      largura: 664,
      altura: 712,
      x: 301,
      y: 386,
    });
    // Em graus, o GeoServer interpolaria a latitude em linha reta: o clique em Poconé (MT),
    // a -17,06°, consultaria -15,1°, uns 217 km ao norte.
    const [sul, norte] = [noPixel(0, 712).lat, noPixel(0, 0).lat];
    expect(norte - ((norte - sul) * 386) / 712 - noPixel(301, 386).lat).toBeGreaterThan(1.9);
  });
});
