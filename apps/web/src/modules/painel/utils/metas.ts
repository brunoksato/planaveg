/**
 * As metas são nacionais e valem para o cômputo inteiro: o progresso só aparece no Brasil, sem
 * filtros. Num lugar ou com filtro, o painel mostra os hectares e diz por que não há progresso.
 */
export function metasVisiveis(dimensao: string | undefined, filtrando: boolean): boolean {
  return dimensao === undefined && !filtrando;
}
