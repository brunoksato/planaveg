import { useEffect, useRef, type RefObject } from "react";

import type { MapaWmsHandle } from "@sinaveg/cartography";

import type { GeoServerApi } from "@/shared/api/geoserver";

import { buscarLimitesDosEstados } from "../services/municipios.service";

/**
 * O mapa vai até os estados filtrados quando a escolha muda (revisão da MMA de 16/10/2026). Quem
 * chega por um link com a vista salva fica nela; sem a vista, o mapa vai até os estados. Sem a
 * caixa (um erro de rede), o mapa fica onde está.
 */
export function useZoomAosEstados(
  geoserver: GeoServerApi,
  estados: readonly string[],
  vistaNaUrl: boolean,
  mapa: RefObject<MapaWmsHandle | null>,
) {
  const chave = estados.toSorted().join(",");
  const ficarNaVista = useRef(vistaNaUrl);
  useEffect(() => {
    if (ficarNaVista.current) {
      ficarNaVista.current = false;
      return;
    }
    if (chave === "") return;
    const controle = new AbortController();
    buscarLimitesDosEstados(geoserver, chave.split(","), controle.signal)
      .then((caixa) => {
        if (caixa !== undefined) mapa.current?.ajustarAosLimites(caixa);
      })
      .catch(() => undefined);
    return () => controle.abort();
  }, [geoserver, chave, mapa]);
}
