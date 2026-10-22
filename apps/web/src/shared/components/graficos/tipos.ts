/*
 * Gráficos do painel e da visão geral em HTML e SVG, para leitura do público geral: barras
 * grossas com o nome e o valor escritos ao lado, rosca para partes de um todo com poucas
 * categorias, cor pela identidade da categoria (nunca pela posição) e dica com o número exato ao
 * passar o mouse. Os rótulos são texto de verdade, legíveis por leitor de tela e por teste.
 */

export type ItemBarra = {
  chave: string;
  rotulo: string;
  valor: number;
  /** Cor da categoria; sem ela, o tom único do gráfico. */
  cor?: string | undefined;
  /** Texto extra da dica (nome oficial, número de áreas). */
  detalhe?: string | undefined;
  /** Subtítulo antes do primeiro item do grupo. */
  grupo?: string | undefined;
};

export type Fatia = {
  chave: string;
  rotulo: string;
  valor: number;
  cor: string;
  /** Frase curta sob o nome, na legenda. */
  descricao?: string | undefined;
  /** Texto extra da dica (nome oficial). */
  detalhe?: string | undefined;
};

/** Uma parte das barras divididas, ou um item da legenda de um gráfico. */
export type SegmentoEmpilhado = { chave: string; rotulo: string; cor: string };
