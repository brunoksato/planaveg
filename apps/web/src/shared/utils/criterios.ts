import type { CatalogoNivel } from "@sinaveg/web-contracts";

import { formatarParticipacao } from "./formatos";
import {
  type Criterio,
  criterioDoGrupo,
  ORDEM_DOS_CRITERIOS,
  termoCriterio,
  type Termo,
} from "./glossario";
import { nivelUnicos } from "./niveis";
import { somar } from "./numeros";

/**
 * Cor de cada critério: o laranja dos projetos e o azul do CAR no mapa, que é a maior parte da
 * governança. O par passa no teste de daltonismo.
 */
const COR_CRITERIO: Readonly<Record<Criterio, string>> = {
  intencionalidade: "#d94801",
  governanca: "#08519c",
};

/** Os níveis de cada critério, na ordem da hierarquia. */
export function niveisDoCriterio(
  niveis: readonly CatalogoNivel[],
  criterio: Criterio,
): CatalogoNivel[] {
  return nivelUnicos(niveis).filter((n) => criterioDoGrupo(n.grupo) === criterio);
}

/** Uma fatia por critério (intencionalidade e governança), com a área do ano. */
export function fatiasDosCriterios(
  niveis: readonly CatalogoNivel[],
  porNivel: ReadonlyMap<string, number>,
) {
  return ORDEM_DOS_CRITERIOS.map((criterio) => {
    const termo = termoCriterio(criterio);
    return {
      chave: criterio,
      rotulo: termo.nome,
      descricao: termo.descricao,
      cor: COR_CRITERIO[criterio],
      valor: niveisDoCriterio(niveis, criterio).reduce(
        (soma, n) => soma + (porNivel.get(n.nivel) ?? 0),
        0,
      ),
      termo,
    };
  });
}

/**
 * "A maior parte, 92%, está em áreas com vegetação secundária…" ou, sem maioria, qual parte tem
 * mais área. O percentual é sobre a soma das partes, como na rosca.
 */
export function respostaMaiorParte(
  partes: ReadonlyArray<{ rotulo: string; valor: number; termo: Termo }>,
): string | undefined {
  const total = somar(partes);
  const maior = partes.toSorted((a, b) => b.valor - a.valor)[0];
  if (maior === undefined || total <= 0 || maior.valor <= 0) return undefined;
  const fracao = formatarParticipacao(maior.valor / total);
  if (maior.valor / total >= 0.5 && maior.termo.local !== undefined) {
    return `A maior parte, ${fracao}, está ${maior.termo.local}.`;
  }
  return `${maior.rotulo} tem a maior parte: ${fracao} do total.`;
}
