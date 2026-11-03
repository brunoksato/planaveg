/* oxlint-disable no-underscore-dangle -- lê e substitui campos internos da GridLayer do Leaflet (`_tileZoom`, `_map`, `_update`). */
/**
 * Espera o zoom assentar antes de pedir os tiles de um nível fora do cache.
 *
 * O Leaflet pede os tiles do nível de destino já no início da animação de zoom. Num nível em
 * cache isso é ótimo (os tiles chegam durante a animação), mas num nível fora do cache cada
 * pedido custa um desenho no servidor: em zooms rápidos seguidos, o servidor desenha os níveis
 * atravessados (que ninguém vai ver) e o nível final espera atrás deles. A partir do zoom
 * `esperarDesdeZoom` da camada, um nível só é pedido depois de `ESPERA_ZOOM_MS` sem outro
 * zoom; abaixo dele, e para arrastar no mesmo nível, tudo continua como no Leaflet. O limite é
 * o zoom dos tiles pedidos ao servidor: em tela de alta densidade, o do mapa mais um
 * (`zoomOffset`).
 */

/** Atraso, em milissegundos, para pedir os tiles de um nível fora do cache. */
export const ESPERA_ZOOM_MS = 150;

/** O que a espera lê e guarda numa GridLayer do Leaflet (campos internos e os nossos). */
export type GradeComEspera = {
  /** Nível de tiles da vista (interno do Leaflet). */
  _tileZoom?: number | undefined;
  /** Mapa da camada; some quando a camada sai do mapa (interno do Leaflet). */
  _map?: { _animatingZoom?: boolean } | null | undefined;
  /** Opções da camada; `esperarDesdeZoom` é nossa (ausente = nunca espera). */
  options?: { esperarDesdeZoom?: number | undefined; zoomOffset?: number | undefined } | undefined;
  _zoomPedido?: number | undefined;
  _espera?: ReturnType<typeof setTimeout> | undefined;
};

/** Um `_update` que espera o zoom assentar nos níveis a partir de `esperarDesdeZoom`. */
export function comEsperaDeZoom(
  atualizar: (this: GradeComEspera) => void,
  esperaMs: number = ESPERA_ZOOM_MS,
): (this: GradeComEspera) => void {
  return function atualizarComEspera(this: GradeComEspera): void {
    const zoom = this._tileZoom;
    const limite = this.options?.esperarDesdeZoom;
    const primeira = !("_zoomPedido" in this);
    // Primeira carga, ou nível em cache: como o Leaflet faz.
    const deslocamento = this.options?.zoomOffset ?? 0;
    if (primeira || limite === undefined || zoom === undefined || zoom + deslocamento < limite) {
      parar(this);
      this._zoomPedido = zoom;
      atualizar.call(this);
      return;
    }
    // Início de uma animação de zoom: não pede nada; o fim dela chama de novo.
    if (this._map?._animatingZoom) {
      parar(this);
      this._zoomPedido = undefined;
      return;
    }
    if (zoom === this._zoomPedido) {
      // Nível assentado (arrastar): na hora. Espera correndo (o `moveend` logo depois do fim
      // do zoom): aguarda a mesma espera.
      if (this._espera === undefined) atualizar.call(this);
      return;
    }
    parar(this);
    this._zoomPedido = zoom;
    this._espera = setTimeout(() => {
      this._espera = undefined;
      // Durante a espera, a camada pode ter saído do mapa ou outro zoom ter começado.
      if (this._map && !this._map._animatingZoom && this._tileZoom === zoom) {
        atualizar.call(this);
      } else {
        this._zoomPedido = undefined;
      }
    }, esperaMs);
  };
}

function parar(grade: GradeComEspera): void {
  clearTimeout(grade._espera);
  grade._espera = undefined;
}
