import { naBusca, texto } from "@/shared/utils/parametros";

/** Os valores escolhidos numa dimensão, separados por vírgula, nos caracteres dela. */
function lista(formato: RegExp) {
  return naBusca(texto(formato, 1_000));
}

/**
 * Os filtros das áreas na URL, com os mesmos nomes no mapa e no painel (um link leva os filtros
 * de uma tela à outra), para entrar no schema da busca de cada página. O que foge do formato
 * fica de fora.
 */
export const filtrosNaUrl = {
  categorias: lista(/^[a-z_,]+$/),
  situacoes: lista(/^[a-z_,]+$/),
  caminhos: lista(/^[a-z_,]+$/),
  estados: lista(/^[A-Z,]+$/),
  biomas: lista(/^[\p{L} ,]+$/u),
  temas: lista(/^[a-z0-9_,]+$/),
};

export type FiltrosNaUrl = { [K in keyof typeof filtrosNaUrl]?: string | undefined };
