/** A soma dos valores das partes. */
export function somar(partes: ReadonlyArray<{ valor: number }>): number {
  return partes.reduce((soma, parte) => soma + parte.valor, 0);
}
