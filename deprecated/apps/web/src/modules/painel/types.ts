import type * as z from "zod/mini";

import type { parametrosDoPainel } from "./parametros";

/** Troca o lugar do painel; `undefined` nos dois volta ao Brasil inteiro. */
export type MudarLugar = (lugar: {
  dimensao?: string | undefined;
  chave?: string | undefined;
}) => void;

/**
 * O que todo CSV do painel leva: o ano, o lugar e os filtros em cada linha, e o fim do nome do
 * arquivo (`mato-grosso-filtrado`, antes do ano).
 */
export type ContextoCsv = { ano: number; lugar: string; filtros: string; arquivo: string };

/** O número principal de um cartão e o que ele mede. */
export type Indicador = { valor: string; rotulo?: string | undefined };

/** O estado do painel na URL, como o schema o lê: cada campo é opcional (sem ele, o padrão). */
export type EstadoPainel = z.output<typeof parametrosDoPainel>;

/** Uma alteração do estado: os campos que mudam; `undefined` volta o campo ao padrão. */
export type AlteracaoPainel = EstadoPainel;
