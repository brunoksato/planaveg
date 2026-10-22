import type { CatalogoArranjo } from "@sinaveg/web-contracts";

import { formatarHectaresResumido, formatarParte } from "./formatos";

/**
 * As metas de recuperação do Planaveg por arranjo (Figura 4 do relatório técnico), que vêm do
 * catálogo. A meta nacional é a soma delas, e o que já se atingiu é o cômputo inteiro, com as
 * demais áreas de projetos, que não têm meta própria.
 */

type ProgressoArranjo = {
  arranjo: string;
  area: number;
  meta: number;
  /** Área sobre a meta; passa de 1 quando a meta já foi superada. */
  fracao: number;
};

export type ProgressoDasMetas = {
  itens: ProgressoArranjo[];
  total: { area: number; meta: number; fracao: number; ano: number };
};

function temMeta(arranjo: Pick<CatalogoArranjo, "meta_ha">): boolean {
  return arranjo.meta_ha !== null && arranjo.meta_ha > 0;
}

/**
 * Os três arranjos do plano são os que têm meta; o resto (as demais áreas de projetos, que não
 * entram em nenhum) não ganha caixa nem lugar nas listas, só uma nota, como a revisão do MMA
 * pede: o plano tem três arranjos.
 */
export function separarArranjos<A extends Pick<CatalogoArranjo, "meta_ha">>(
  arranjos: readonly A[],
): { doPlano: A[]; resto: A[] } {
  return {
    doPlano: arranjos.filter((a) => temMeta(a)),
    resto: arranjos.filter((a) => !temMeta(a)),
  };
}

/** A nota do resto: "Demais áreas de projetos: 475 mil ha (5,4%), fora dos três arranjos…". */
export function notaDoResto(nome: string, area: number, total: number): string {
  const parte = formatarParte(area, total);
  return `${nome}: ${formatarHectaresResumido(area)} (${parte}), fora dos três arranjos e sem meta própria.`;
}

/**
 * O progresso de cada arranjo com meta e o da meta nacional, que é todo o cômputo sobre a soma das
 * metas; sem metas no catálogo, nada.
 */
export function progressoDasMetas(
  arranjos: readonly CatalogoArranjo[],
  porArranjo: ReadonlyMap<string, number>,
): ProgressoDasMetas | undefined {
  const comMeta = separarArranjos(arranjos).doPlano;
  if (comMeta.length === 0) return undefined;
  const itens = comMeta.map((a) => {
    const area = porArranjo.get(a.arranjo) ?? 0;
    const meta = a.meta_ha ?? 0;
    return { arranjo: a.arranjo, area, meta, fracao: area / meta };
  });
  const area = arranjos.reduce((soma, a) => soma + (porArranjo.get(a.arranjo) ?? 0), 0);
  const meta = itens.reduce((soma, i) => soma + i.meta, 0);
  const ano = Math.max(...comMeta.map((a) => a.meta_ano ?? 0));
  return { itens, total: { area, meta, fracao: area / meta, ano } };
}
