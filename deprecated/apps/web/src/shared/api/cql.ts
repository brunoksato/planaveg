/** Literal ECQL entre aspas simples, com as aspas internas dobradas. */
export function textoCql(valor: string): string {
  return `'${valor.replaceAll("'", "''")}'`;
}

/**
 * A busca pelo nome: o termo em qualquer parte da coluna `busca` (o rótulo em minúsculas e sem
 * acento). O termo já vem como `termoDeBusca` o deixa, sem acento e sem curinga, e não passa
 * por ela de novo.
 */
export function cqlDaBusca(termo: string): string {
  return `busca LIKE ${textoCql(`%${termo}%`)}`;
}
