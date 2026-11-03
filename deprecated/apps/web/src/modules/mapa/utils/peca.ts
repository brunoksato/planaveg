import type { AtributosPeca } from "@sinaveg/web-contracts";

import { formatarAreaMapeada, formatarInteiro } from "@/shared/utils/formatos";

import type { PoligonoClicado } from "../types";

/**
 * A peça de que o polígono clicado faz parte: a base junta numa peça todos os polígonos com os
 * mesmos atributos no município e na bacia. Peça de um polígono só, nada a dizer; sem o
 * polígono, a área mostrada é a da peça inteira.
 */
export function descreverConjunto(
  peca: Pick<AtributosPeca, "area_ha"> & { poligono: PoligonoClicado | null },
): string | undefined {
  const sufixo = "com estes mesmos dados no município e na bacia";
  if (peca.poligono === null) return `Soma de todos os polígonos ${sufixo}.`;
  if (peca.poligono.partes <= 1) return undefined;
  return (
    `É um de ${formatarInteiro(peca.poligono.partes)} polígonos ${sufixo}, ` +
    `que somam ${formatarAreaMapeada(peca.area_ha)}.`
  );
}

/** "UC estadual (APA)", "UC federal e municipal"; fora de UC, nada. */
export function descreverUc(
  peca: Pick<AtributosPeca, "uc_federal" | "uc_estadual" | "uc_municipal" | "apa" | "rppn" | "uc">,
): string | undefined {
  if (!peca.apa && !peca.rppn && !peca.uc) return undefined;
  const esferas = [
    peca.uc_federal ? "federal" : undefined,
    peca.uc_estadual ? "estadual" : undefined,
    peca.uc_municipal ? "municipal" : undefined,
  ].filter((e): e is string => e !== undefined);
  const tipos = [peca.apa ? "APA" : undefined, peca.rppn ? "RPPN" : undefined].filter(
    (t): t is string => t !== undefined,
  );
  const esfera = esferas.length === 0 ? "" : ` ${esferas.join(" e ")}`;
  return `UC${esfera}${tipos.length === 0 ? "" : ` (${tipos.join(", ")})`}`;
}

/** As fontes dos projetos de recuperação, na ordem do contrato. */
const FONTES_DE_PROJETO = [
  ["licenciamento", "licenciamento ambiental (Recooperar)"],
  ["reparacao_danos", "reparação de danos (Recooperar)"],
  ["embargo", "embargo do IBAMA (Recooperar)"],
  ["outras_areas", "outras áreas do Recooperar"],
  ["gef_terrestre", "GEF Terrestre"],
  ["restauracao_ecologica", "Restauração Ecológica"],
  ["observatorio", "Observatório da Restauração"],
] as const;

type FonteDeProjeto = (typeof FONTES_DE_PROJETO)[number][0];

/** "GEF Terrestre, Restauração Ecológica"; fora de projeto, nada. */
export function descreverProjetos(peca: Pick<AtributosPeca, FonteDeProjeto>): string | undefined {
  const fontes = FONTES_DE_PROJETO.filter(([marca]) => peca[marca]).map(([, nome]) => nome);
  return fontes.length === 0 ? undefined : fontes.join(", ");
}

const SIGLAS: Record<string, string> = {
  PROJ: "projeto",
  CAR: "imóvel do CAR",
  APA: "APA",
  RPPN: "RPPN",
  UC: "UC",
  MANG: "manguezal",
  TI: "Terra Indígena",
  AS: "assentamento",
  QL: "território quilombola",
};

/** As siglas da maior para a menor: no texto, a mais longa que casa ganha. */
const SIGLAS_POR_TAMANHO = Object.keys(SIGLAS).toSorted((a, b) => b.length - a.length);

/** `PROJCARAS` → "projeto, imóvel do CAR, assentamento". */
export function siglasSobreposicao(texto: string): string {
  const partes: string[] = [];
  let resto = texto;
  while (resto.length > 0) {
    const sigla = SIGLAS_POR_TAMANHO.find((s) => resto.startsWith(s));
    if (sigla === undefined) return texto;
    partes.push(SIGLAS[sigla] ?? sigla);
    resto = resto.slice(sigla.length);
  }
  return partes.join(", ");
}
