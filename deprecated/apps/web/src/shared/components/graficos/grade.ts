/*
 * Grade das barras: num contêiner estreito, o nome numa linha e, embaixo, a barra e o valor; a
 * partir de `@md` (a largura do gráfico, `FiguraGrafico`, não a da janela), nome, barra e valor
 * lado a lado. Uma grade só para todas as linhas (subgrid), para as barras começarem e terminarem
 * no mesmo lugar em todos os grupos.
 */
export const GRADE =
  "grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 @md:grid-cols-[minmax(9rem,15rem)_minmax(0,1fr)_auto] @3xl:grid-cols-[minmax(10rem,19rem)_minmax(0,1fr)_auto]";
export const LINHA = "col-span-full grid grid-cols-subgrid items-center gap-y-1.5";
export const NOME = "col-span-2 min-w-0 text-[15px] leading-snug @md:col-span-1";
export const VALOR =
  "col-start-2 row-start-2 text-right text-sm whitespace-nowrap tabular-nums @md:col-start-3 @md:row-start-1";
export const TRILHO = "col-start-1 row-start-2 h-4 @md:col-start-2 @md:row-start-1 @md:h-5";
