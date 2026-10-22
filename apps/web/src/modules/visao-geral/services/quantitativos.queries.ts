import type { GeoServerApi } from "@/shared/api/geoserver";
import { useDados } from "@/shared/services/catalogo.queries";

import { buscarQuantitativoArranjo, buscarQuantitativoNivel } from "./quantitativos.service";

export function useQuantitativoNivel(api: GeoServerApi) {
  return useDados(api, ["quantitativo_nivel"], (signal) => buscarQuantitativoNivel(api, signal));
}

export function useQuantitativoArranjo(api: GeoServerApi) {
  return useDados(api, ["quantitativo_arranjo"], (signal) =>
    buscarQuantitativoArranjo(api, signal),
  );
}
