import { useMemo } from "react";

import type { CamadaMapa } from "@sinaveg/cartography";

import type { GeoServerApi } from "@/shared/api/geoserver";
import type { Catalogo } from "@/shared/services/catalogo.service";

import { montarCamadas } from "../utils/camadas";
import type { EstadoDoMapa } from "./useEstadoDoMapa";

/** As camadas do mapa, refeitas só quando muda o que as decide. */
export function useCamadasDoMapa(
  geoserver: GeoServerApi,
  catalogo: Catalogo,
  estado: EstadoDoMapa,
  municipio: string | undefined,
): CamadaMapa[] {
  const {
    filtros,
    cqlDasAreas,
    cqlDosTemas,
    camadasDaLegenda,
    ordemPropria,
    nomeCamadaPecas,
    opacidade,
    camadasPorNome,
  } = estado;
  const versaoMapa = catalogo.fonte?.versao_mapa ?? undefined;
  const versaoDados = catalogo.fonte?.versao_dados ?? undefined;
  return useMemo(
    () =>
      montarCamadas({
        geoserver,
        filtros,
        cqlDasAreas,
        cqlDosTemas,
        camadasDaLegenda,
        ordemPropria,
        nomeCamadaPecas,
        opacidade,
        municipio,
        camadasPorNome,
        versaoMapa,
        versaoDados,
      }),
    [
      camadasDaLegenda,
      camadasPorNome,
      cqlDasAreas,
      cqlDosTemas,
      filtros,
      geoserver,
      municipio,
      nomeCamadaPecas,
      opacidade,
      ordemPropria,
      versaoDados,
      versaoMapa,
    ],
  );
}
