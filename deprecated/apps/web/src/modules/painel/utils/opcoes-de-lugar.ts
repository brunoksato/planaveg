import type { QuantitativoDimensao } from "@sinaveg/web-contracts";

import { nomeLugar } from "@/shared/utils/glossario";

/** Um lugar para escolher: a chave, o nome para leitura e, quando há, a área. */
export type OpcaoValor = { chave: string; rotulo: string; area_ha?: number | undefined };

/** Um valor por chave, com o nome para leitura; a busca remota não traz a área. */
export function unicos(
  dimensao: string,
  linhas: ReadonlyArray<Pick<QuantitativoDimensao, "chave" | "rotulo"> & { area_ha?: number }>,
): OpcaoValor[] {
  const vistos = new Map<string, OpcaoValor>();
  for (const linha of linhas) {
    if (linha.chave === null || vistos.has(linha.chave)) continue;
    vistos.set(linha.chave, {
      chave: linha.chave,
      rotulo: nomeLugar(dimensao, linha.chave, linha.rotulo),
      area_ha: linha.area_ha,
    });
  }
  return [...vistos.values()];
}
