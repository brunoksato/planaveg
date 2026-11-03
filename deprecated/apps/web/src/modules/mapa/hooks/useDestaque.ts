import { useMemo } from "react";

import type { Destaque } from "@sinaveg/cartography";
import type { MunicipioBusca } from "@sinaveg/web-contracts";

import type { Feicao, Geometria } from "@/shared/api/geoserver";

import type { Identificacao } from "../types";

/**
 * O que o mapa contorna: a área clicada (o polígono clicado ou, sem ele, a geometria simplificada
 * da peça inteira, quando existe) ou, sem clique, o município.
 */
export function useDestaque(
  identificacao: Identificacao | undefined,
  municipio: Feicao<MunicipioBusca> | undefined,
): Destaque | null {
  return useMemo((): Destaque | null => {
    const geometrias = (identificacao?.pecas ?? [])
      .map((p) => p.poligono?.geometria ?? p.geometria)
      .filter((g): g is Geometria => g !== null);
    if (geometrias.length > 0) {
      return {
        type: "FeatureCollection",
        features: geometrias.map((geometry) => ({ type: "Feature", geometry, properties: {} })),
      } as Destaque;
    }
    if (municipio === undefined || municipio.geometria === null) return null;
    return { type: "Feature", geometry: municipio.geometria, properties: {} } as Destaque;
  }, [identificacao, municipio]);
}
