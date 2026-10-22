import type { Total } from "@/modules/filtros";
import { formatarContagem } from "@/shared/utils/formatos";
import {
  foraDosLimites,
  type NomeDimensao,
  NOTA_DO_NOME_DA_BACIA,
  palavrasDoGenero,
} from "@/shared/utils/glossario";

import type { ValorRanking } from "../services/lugar.service";

/** Os valores com área, do maior para o menor. */
export function comArea(mapa: ReadonlyMap<string, Total>): Array<readonly [string, Total]> {
  return [...mapa].filter(([, total]) => total.area > 0).toSorted((a, b) => b[1].area - a[1].area);
}

/** Os valores somados nas facetas como uma lista de lugares (`SecaoRanking`): o valor é a chave. */
export function comoRanking(valores: ReadonlyArray<readonly [string, Total]>): ValorRanking[] {
  return valores.map(([valor, total]) => ({
    chave: valor,
    rotulo: valor,
    area_ha: total.area,
    n_poligonos: total.poligonos,
  }));
}

/**
 * A área se divide entre mais de um valor de verdade: o segundo maior (fora "fora dos limites")
 * tem ao menos 1% dela.
 */
export function seDivide(valores: ReadonlyArray<readonly [string, Total]>, total: number): boolean {
  const segundo = valores.filter(([valor]) => !foraDosLimites(valor))[1];
  return segundo !== undefined && total > 0 && segundo[1].area >= total * 0.01;
}

/** A fração de `total` (0 a 1), para o CSV; sem total, vazio. */
export function participacao(valor: number, total: number): number | null {
  return total > 0 ? valor / total : null;
}

/**
 * "1.623 polígonos", na dica de um item e nos indicadores: o painel conta polígonos, como o mapa.
 */
export function textoDosPoligonos(poligonos: number): string {
  return formatarContagem(poligonos, "polígono", "polígonos");
}

/**
 * A nota sob uma lista de lugares: a das bacias diz o que vai entre parênteses, e a que mostra a
 * área total, sem os filtros, avisa isso.
 */
export function notaDaLista(
  dimensao: string,
  nomes: NomeDimensao,
  semOsFiltros: boolean,
): string | undefined {
  const notas = [
    dimensao === "bacia" ? NOTA_DO_NOME_DA_BACIA : undefined,
    semOsFiltros
      ? `Esta lista mostra a área total de cada ${nomes.singular}, sem os filtros. Escolha ${nomes.artigo} ${nomes.singular} para ver os números ${palavrasDoGenero(nomes).dele} com os filtros.`
      : undefined,
  ].filter((nota) => nota !== undefined);
  return notas.length === 0 ? undefined : notas.join(" ");
}
