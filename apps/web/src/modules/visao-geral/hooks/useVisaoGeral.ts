import type { QuantitativoArranjo, QuantitativoNivel } from "@sinaveg/web-contracts";

import type { GeoServerApi } from "@/shared/api/geoserver";
import { useCatalogo } from "@/shared/services/catalogo.queries";

import { useQuantitativoArranjo, useQuantitativoNivel } from "../services/quantitativos.queries";

/**
 * Os números da página inicial: o catálogo e a área de cada nível e de cada arranjo na base mais
 * recente (o ano do catálogo).
 */
export function useVisaoGeral(geoserver: GeoServerApi) {
  const catalogo = useCatalogo(geoserver);
  const nivel = useQuantitativoNivel(geoserver);
  const arranjo = useQuantitativoArranjo(geoserver);
  const ano = catalogo.data?.ano;
  return {
    catalogo: catalogo.data,
    porNivel: areaPorNivel(nivel.data ?? [], ano),
    porArranjo: arranjo.data === undefined ? undefined : areaPorArranjo(arranjo.data, ano),
    erro: catalogo.error ?? nivel.error ?? arranjo.error,
    carregando: catalogo.isPending || nivel.isPending || arranjo.isPending,
  };
}

/**
 * A área de cada nível no ano. Os níveis 9 a 11 têm uma linha por condição do CAR: a área do
 * nível é a soma delas.
 */
function areaPorNivel(
  linhas: readonly QuantitativoNivel[],
  ano: number | undefined,
): Map<string, number> {
  const porNivel = new Map<string, number>();
  for (const linha of linhas) {
    if (linha.ano_vs !== ano) continue;
    porNivel.set(linha.nivel, (porNivel.get(linha.nivel) ?? 0) + linha.area_ha);
  }
  return porNivel;
}

/** A área de cada arranjo no ano: a consulta já traz o total de cada um, sem nada a somar. */
function areaPorArranjo(
  linhas: readonly QuantitativoArranjo[],
  ano: number | undefined,
): Map<string, number> {
  const porArranjo = new Map<string, number>();
  for (const linha of linhas) {
    if (linha.ano_vs === ano) porArranjo.set(linha.arranjo, linha.area_ha);
  }
  return porArranjo;
}
