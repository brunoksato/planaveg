import { formatarInteiro, formatarParticipacao } from "@/shared/utils/formatos";

import type { ItemBarra } from "./tipos";

/** Texto da dica: nome, número exato e participação. */
export function dica(rotulo: string, valor: number, total: number | undefined, detalhe?: string) {
  const partes = [`${rotulo}: ${formatarInteiro(valor)} ha`];
  if (total !== undefined && total > 0) partes.push(`(${formatarParticipacao(valor / total)})`);
  return [partes.join(" "), detalhe].filter(Boolean).join(" · ");
}

/** Itens consecutivos do mesmo grupo, na ordem em que vieram. */
export function emBlocos(
  itens: readonly ItemBarra[],
): { grupo: string | undefined; itens: ItemBarra[] }[] {
  const blocos: { grupo: string | undefined; itens: ItemBarra[] }[] = [];
  for (const item of itens) {
    const ultimo = blocos.at(-1);
    if (ultimo !== undefined && ultimo.grupo === item.grupo) ultimo.itens.push(item);
    else blocos.push({ grupo: item.grupo, itens: [item] });
  }
  return blocos;
}
