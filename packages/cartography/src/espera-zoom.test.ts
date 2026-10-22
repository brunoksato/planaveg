/* oxlint-disable no-underscore-dangle -- o teste imita os campos internos da GridLayer. */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { comEsperaDeZoom, ESPERA_ZOOM_MS, type GradeComEspera } from "./espera-zoom";

/**
 * Uma camada que espera a partir do zoom 11 (nas peças, o primeiro fora do cache semeado é o 12).
 * O mecanismo vale para qualquer limite.
 */
function grade(
  zoom: number,
  opcoes: { esperarDesdeZoom?: number; zoomOffset?: number } = { esperarDesdeZoom: 11 },
) {
  const atualizar = vi.fn<(this: GradeComEspera) => void>();
  const camada: GradeComEspera & { _update: () => void } = {
    _tileZoom: zoom,
    _map: { _animatingZoom: false },
    options: opcoes,
    _update: comEsperaDeZoom(atualizar),
  };
  return { camada, atualizar };
}

/** O que o Leaflet faz num zoom animado: chama no início, e no fim duas vezes (zoom e moveend). */
function zoomAnimado(camada: GradeComEspera & { _update: () => void }, para: number) {
  camada._tileZoom = para;
  camada._map = { _animatingZoom: true };
  camada._update();
  camada._map = { _animatingZoom: false };
  camada._update();
  camada._update();
}

describe("comEsperaDeZoom", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("pede na hora na primeira carga, mesmo fora do cache, e ao arrastar no mesmo nível", () => {
    const { camada, atualizar } = grade(12);

    camada._update();
    camada._update();

    expect(atualizar).toHaveBeenCalledTimes(2);
  });

  it("num nível fora do cache, pede uma vez, depois da espera que segue o fim da animação", () => {
    const { camada, atualizar } = grade(10);
    camada._update();

    zoomAnimado(camada, 11);
    expect(atualizar).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(ESPERA_ZOOM_MS);
    expect(atualizar).toHaveBeenCalledTimes(2);
    expect(atualizar.mock.contexts.at(-1)?._tileZoom).toBe(11);

    camada._update(); // arrastar depois, já assentado: na hora
    expect(atualizar).toHaveBeenCalledTimes(3);
  });

  it("não pede os níveis atravessados por zooms rápidos seguidos", () => {
    const { camada, atualizar } = grade(10);
    camada._update();

    for (const zoom of [11, 12, 13]) {
      zoomAnimado(camada, zoom);
      vi.advanceTimersByTime(ESPERA_ZOOM_MS / 2);
    }
    vi.advanceTimersByTime(ESPERA_ZOOM_MS);

    // Só a primeira carga e o nível 13, onde o zoom parou.
    expect(atualizar).toHaveBeenCalledTimes(2);
    expect(atualizar.mock.contexts.at(-1)?._tileZoom).toBe(13);
  });

  it("não pede nada se a camada saiu do mapa durante a espera", () => {
    const { camada, atualizar } = grade(10);
    camada._update();

    zoomAnimado(camada, 11);
    camada._map = undefined;
    vi.advanceTimersByTime(ESPERA_ZOOM_MS);

    expect(atualizar).toHaveBeenCalledTimes(1);
  });
});
