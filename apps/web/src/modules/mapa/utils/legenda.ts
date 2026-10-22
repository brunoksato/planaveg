/**
 * A ordem dos tipos de área no mapa, de cima para baixo (`ordem` na URL). O padrão é a ordem da
 * hierarquia: os projetos por cima, a Reserva Legal embaixo, como o estilo desenha o mapa vindo
 * do cache. Códigos desconhecidos ou repetidos saem; os que faltam vão para o fim.
 */
export function lerOrdem(texto: string | undefined, padrao: readonly string[]): string[] {
  const conhecidos = new Set(padrao);
  const lidos = new Set((texto ?? "").split(",").filter((c) => conhecidos.has(c)));
  return [...lidos, ...padrao.filter((c) => !lidos.has(c))];
}

/** A ordem para a URL; a padrão não vai. */
export function escreverOrdem(
  ordem: readonly string[],
  padrao: readonly string[],
): string | undefined {
  const igual = ordem.length === padrao.length && ordem.every((c, i) => c === padrao[i]);
  return igual ? undefined : ordem.join(",");
}

/**
 * Sobe (-1) ou desce (1) um tipo uma posição entre os que estão no mapa; os desmarcados guardam
 * o lugar deles na ordem.
 */
export function moverNaOrdem(
  ordem: readonly string[],
  noMapa: readonly string[],
  codigo: string,
  passo: -1 | 1,
): string[] {
  const marcados = new Set(noMapa);
  const visiveis = ordem.filter((c) => marcados.has(c));
  const indice = visiveis.indexOf(codigo);
  const vizinho = visiveis[indice + passo];
  if (indice < 0 || vizinho === undefined) return [...ordem];
  return ordem.map((c) => (c === codigo ? vizinho : c === vizinho ? codigo : c));
}
