import type { CatalogoNivel } from "@sinaveg/web-contracts";

import { niveisDoCriterio } from "@/shared/utils/criterios";
import { type Criterio, termoNivel } from "@/shared/utils/glossario";

import { NIVEIS_CAR } from "./constantes";

/** Uma linha "Fonte / Camada" da tabela de critérios do Planaveg, com a área do ano. */
export type Fonte = {
  chave: string;
  rotulo: string;
  descricao: string | undefined;
  cor: string;
  valor: number;
  /** A base traz a fonte (o MonitoRAD, por exemplo, não vem). */
  presente: boolean;
};

const CAR = "app_aur_rl";

/**
 * As fontes de um critério, na ordem da hierarquia. Cada nível é uma fonte, menos APP, AUR e RL,
 * que a tabela junta numa linha só ("APP / AUR / RL"), com a cor da primeira.
 */
export function fontesDoCriterio(
  niveis: readonly CatalogoNivel[],
  criterio: Criterio,
  porNivel: ReadonlyMap<string, number>,
): Fonte[] {
  const fontes: Fonte[] = [];
  for (const nivel of niveisDoCriterio(niveis, criterio)) {
    const termo = termoNivel(nivel.nivel, nivel.titulo);
    const valor = porNivel.get(nivel.nivel) ?? 0;
    const doCar = (NIVEIS_CAR as readonly string[]).includes(nivel.nivel);
    const juntas = doCar ? fontes.find((f) => f.chave === CAR) : undefined;
    if (juntas === undefined) {
      fontes.push({
        chave: doCar ? CAR : nivel.nivel,
        rotulo: termo.nome,
        descricao: doCar
          ? "Áreas de Preservação Permanente, de Uso Restrito e de Reserva Legal dos imóveis do CAR."
          : termo.descricao,
        cor: nivel.cor,
        valor,
        presente: nivel.presente,
      });
    } else {
      juntas.rotulo = `${juntas.rotulo} / ${termo.nome}`;
      juntas.valor += valor;
      juntas.presente ||= nivel.presente;
    }
  }
  return fontes;
}
