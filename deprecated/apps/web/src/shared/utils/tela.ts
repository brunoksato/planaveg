/**
 * A largura do computador: a partir dela, a lateral fica ao lado do conteúdo, e a legenda do mapa
 * e a lista dos tipos de área do painel começam abertas. 64rem (1.024 px) é o `lg` do Tailwind, o
 * mesmo das classes `lg:`.
 */
const LARGURA_DO_COMPUTADOR = "(min-width: 64rem)";

/** A tela tem a largura do computador (a lateral fica ao lado do conteúdo). */
export function telaLarga(): boolean {
  return (
    typeof window.matchMedia === "function" && window.matchMedia(LARGURA_DO_COMPUTADOR).matches
  );
}
