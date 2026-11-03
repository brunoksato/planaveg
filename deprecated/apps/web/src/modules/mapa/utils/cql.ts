import { textoCql } from "@/shared/api/cql";

/** O filtro de um município, pelo código do IBGE: o contorno, o CSV e a busca pelo código. */
export function cqlDoMunicipio(codigo: string): string {
  return `cod_municipio = ${textoCql(codigo)}`;
}

/** O filtro com o município escolhido junto (para o CSV do município). */
export function comMunicipio(cql: string | undefined, municipio: string): string {
  return [cqlDoMunicipio(municipio), cql].filter(Boolean).join(" AND ");
}
