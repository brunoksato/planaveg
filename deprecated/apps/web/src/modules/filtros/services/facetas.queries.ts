import type { GeoServerApi } from "@/shared/api/geoserver";
import { useDados } from "@/shared/services/catalogo.queries";

import { buscarFacetas } from "./facetas.service";

/** As facetas das peças de um ano no Brasil, no mapa e no painel. */
export function useFacetas(api: GeoServerApi, ano: number | undefined) {
  return useDados(
    api,
    ["quantitativo_faceta", ano],
    (signal) => buscarFacetas(api, ano, signal),
    ano !== undefined,
  );
}
