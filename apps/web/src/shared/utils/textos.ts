/** O texto com a primeira letra maiúscula ("mato Grosso" → "Mato Grosso"). */
export function maiuscula(texto: string): string {
  return texto.charAt(0).toLocaleUpperCase("pt-BR") + texto.slice(1);
}

/**
 * O texto como a busca pelo nome o compara: sem acento e em minúsculas, como a coluna `busca` do
 * GeoServer guarda o rótulo ("pará" e "Para" acham "Pará (PA)"), e só com letras, dígitos,
 * espaço, hífen e apóstrofo. Sem o resto, nada do que se digita vira curinga no `LIKE` (`%`, `_`).
 * O apóstrofo curvo dos teclados de celular vira o reto, o dos nomes ("Pau d'Arco").
 */
export function termoDeBusca(texto: string): string {
  return texto
    .normalize("NFD")
    .replaceAll(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("pt-BR")
    .replaceAll(/[‘’]/g, "'")
    .replaceAll(/[^\p{L}\p{N} '-]/gu, "")
    .replaceAll(/ {2,}/g, " ")
    .trim();
}

/** Se o texto tem o termo (já passado por `termoDeBusca`), com os dois comparados do mesmo jeito. */
export function temOTermo(texto: string, termo: string): boolean {
  return termoDeBusca(texto).includes(termo);
}
