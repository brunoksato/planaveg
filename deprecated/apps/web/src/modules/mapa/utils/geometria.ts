import type { Caixa } from "@sinaveg/cartography";

import type { Geometria } from "@/shared/api/geoserver";

/** Caixa de uma geometria GeoJSON (lon/lat), percorrendo as coordenadas. */
export function caixaDaGeometria(geometria: Geometria | null): Caixa | undefined {
  if (geometria === null) return undefined;
  let oeste = Infinity;
  let sul = Infinity;
  let leste = -Infinity;
  let norte = -Infinity;
  const visitar = (valor: unknown): void => {
    if (!Array.isArray(valor)) return;
    if (typeof valor[0] === "number" && typeof valor[1] === "number") {
      oeste = Math.min(oeste, valor[0]);
      leste = Math.max(leste, valor[0]);
      sul = Math.min(sul, valor[1]);
      norte = Math.max(norte, valor[1]);
      return;
    }
    for (const item of valor) visitar(item);
  };
  visitar(geometria.coordinates);
  return Number.isFinite(oeste) ? [oeste, sul, leste, norte] : undefined;
}

/** A caixa que contém todas as caixas dadas; sem nenhuma, nada. */
export function unirCaixas(caixas: ReadonlyArray<Caixa | undefined>): Caixa | undefined {
  let uniao: Caixa | undefined;
  for (const caixa of caixas) {
    if (caixa === undefined) continue;
    uniao =
      uniao === undefined
        ? caixa
        : [
            Math.min(uniao[0], caixa[0]),
            Math.min(uniao[1], caixa[1]),
            Math.max(uniao[2], caixa[2]),
            Math.max(uniao[3], caixa[3]),
          ];
  }
  return uniao;
}
