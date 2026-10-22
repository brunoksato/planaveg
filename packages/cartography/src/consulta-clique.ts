/**
 * O `GetFeatureInfo` de um clique, no sistema da própria tela. O GeoServer acha o ponto clicado
 * interpolando o pixel em linha reta entre as bordas da caixa, no sistema do `srs`. A tela do
 * Leaflet é Web Mercator (EPSG:3857), em que a latitude não anda em linha reta com o pixel: com a
 * caixa em graus (EPSG:4326), o ponto consultado caía até 2° ao norte do clicado na vista do
 * Brasil inteiro. Com a caixa em metros do próprio Web Mercator, é o ponto clicado em qualquer
 * zoom.
 */

type Ponto = { x: number; y: number };
type LatLng = { lat: number; lng: number };

/** Parâmetros do `GetFeatureInfo` (WMS 1.1.1, EPSG:3857) de um clique. */
export type ConsultaClique = {
  /** [oeste, sul, leste, norte] da vista, em metros no Web Mercator. */
  bbox: readonly [number, number, number, number];
  /** O tamanho do mapa, em pixels. */
  largura: number;
  altura: number;
  /** O pixel clicado, contado do canto noroeste do mapa. */
  x: number;
  y: number;
};

/** Só o que a conta usa do `L.Map` e do seu `crs`: o teste roda sem o Leaflet, que pede o DOM. */
type Mapa = {
  getBounds: () => { getSouthWest: () => LatLng; getNorthEast: () => LatLng };
  getSize: () => Ponto;
};
type Projecao = { project: (latlng: LatLng) => Ponto };

/** A consulta do clique no pixel `ponto`, com a caixa da vista projetada pelo `crs` do mapa. */
export function consultaDoClique(mapa: Mapa, crs: Projecao, ponto: Ponto): ConsultaClique {
  const limites = mapa.getBounds();
  const sudoeste = crs.project(limites.getSouthWest());
  const nordeste = crs.project(limites.getNorthEast());
  const tamanho = mapa.getSize();
  return {
    bbox: [sudoeste.x, sudoeste.y, nordeste.x, nordeste.y],
    largura: tamanho.x,
    altura: tamanho.y,
    x: ponto.x,
    y: ponto.y,
  };
}
