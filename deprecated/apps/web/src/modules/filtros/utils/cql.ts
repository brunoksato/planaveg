import { textoCql } from "@/shared/api/cql";
import { categoriasDaCondicao } from "@/shared/utils/glossario";

import { COLUNA, DIMENSOES_FILTRO, type FiltrosAreas } from "./filtros";

/** `coluna IN ('a', 'b')`, com os valores em ordem: o mesmo texto que o `_em` do core escreve. */
function cqlDosValores(coluna: string, valores: readonly string[]): string {
  const lista = valores.toSorted().map(textoCql).join(", ");
  return `${coluna} IN (${lista})`;
}

/**
 * O filtro em CQL para as camadas de peças: valores em ordem e espaçamento fixo, para o mesmo
 * filtro dar sempre o mesmo texto (e cair na mesma entrada do cache de tiles). `cqlDosTemas`
 * traz o CQL de cada filtro do relatório; tema sem CQL é ignorado. O aquecimento do cache, no
 * core (`_em`, em `cache/aquecimento.py`), escreve o mesmo texto: mude os dois juntos.
 */
export function cqlDosFiltros(
  filtros: FiltrosAreas,
  cqlDosTemas: ReadonlyMap<string, string>,
): string | undefined {
  const partes: string[] = [];
  for (const dimensao of DIMENSOES_FILTRO) {
    if (dimensao === "temas") continue;
    // A condição do cadastro vira as `categoria` da base que ela junta.
    const valores =
      dimensao === "situacoes"
        ? filtros.situacoes.flatMap(categoriasDaCondicao)
        : filtros[dimensao];
    if (valores.length > 0) partes.push(cqlDosValores(COLUNA[dimensao], valores));
  }
  const temas = filtros.temas
    .toSorted()
    .map((tema) => cqlDosTemas.get(tema))
    .filter((cql): cql is string => cql !== undefined);
  if (temas.length === 1) partes.push(temas[0] ?? "");
  if (temas.length > 1) partes.push(`(${temas.join(" OR ")})`);
  return partes.length === 0 ? undefined : partes.join(" AND ");
}
