import { useEffect, useRef, type RefObject } from "react";

import type { MapaWmsHandle } from "@sinaveg/cartography";
import type { MunicipioBusca } from "@sinaveg/web-contracts";

import type { Feicao, GeoServerApi } from "@/shared/api/geoserver";

import { useMunicipioPorCodigo } from "../services/municipios.queries";
import { caixaDaGeometria } from "../utils/geometria";

/**
 * O município escolhido (na URL): a feição dele, para contornar e ir até ele. Quem chega com o
 * município e sem vista salva (por um link do painel, por exemplo) vai até ele; fora isso, quem
 * move o mapa é a pessoa.
 */
export function useMunicipioEscolhido(
  geoserver: GeoServerApi,
  codigo: string | undefined,
  zoomDaUrl: number | undefined,
  mapa: RefObject<MapaWmsHandle | null>,
) {
  const municipio = useMunicipioPorCodigo(geoserver, codigo);
  const encontrado = municipio.data ?? undefined;
  const voarAoMunicipio = useRef(
    codigo !== undefined && zoomDaUrl === undefined ? codigo : undefined,
  );
  useEffect(() => {
    if (
      encontrado === undefined ||
      encontrado.propriedades.cod_municipio !== voarAoMunicipio.current
    ) {
      return;
    }
    voarAoMunicipio.current = undefined;
    const caixa = caixaDaGeometria(encontrado.geometria);
    if (caixa !== undefined) mapa.current?.ajustarAosLimites(caixa);
  }, [mapa, encontrado]);

  function irPara(feicao: Feicao<MunicipioBusca> | undefined) {
    const caixa = caixaDaGeometria(feicao?.geometria ?? null);
    if (caixa !== undefined) mapa.current?.ajustarAosLimites(caixa);
  }

  return { feicao: encontrado, irPara };
}

/** O que `useMunicipioEscolhido` devolve. */
export type MunicipioEscolhido = ReturnType<typeof useMunicipioEscolhido>;
