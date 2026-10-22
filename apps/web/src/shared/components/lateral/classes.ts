/*
 * Classes das peças da lateral do mapa e do painel, as mesmas nas duas telas.
 */

/** Botão pequeno da lateral (voltar ao padrão, copiar o link), sempre com texto. */
export const BOTAO_LATERAL =
  "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border bg-card px-2.5 text-[13px] font-medium text-foreground transition-colors hover:border-primary hover:text-primary [&_svg]:size-3.5";

/** Link da lateral (CSV, a outra tela): texto pequeno, com ícone. */
export const LINK_LATERAL =
  "inline-flex items-center gap-1.5 text-[13px] font-medium text-primary hover:underline [&_svg]:size-3.5";
