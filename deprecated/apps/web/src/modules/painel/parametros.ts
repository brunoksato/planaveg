import * as z from "zod/mini";

import { filtrosNaUrl } from "@/modules/filtros";
import { naBusca, texto } from "@/shared/utils/parametros";

/**
 * Os parâmetros do painel na URL. `dimensao` sem `chave` = escolhendo um lugar; nenhum = o
 * Brasil inteiro. Cada um é opcional; fora do formato, fica de fora. O painel mostra só a base
 * mais recente; um parâmetro que ele não conhece é ignorado.
 */
export const parametrosDoPainel = z.object({
  /** O tipo de lugar (`uf`, `municipio`, `bioma`…). */
  dimensao: naBusca(texto(/^[a-z_]{1,40}$/)),
  /** O lugar, nessa dimensão (`MT`, `5002209`, `Cerrado`…). */
  chave: naBusca(texto(/^.+$/su)),
  /**
   * Os filtros das áreas, com os mesmos nomes do mapa, para um link levar de uma tela à outra
   * (estados e biomas, não: no painel, eles são o lugar).
   */
  categorias: filtrosNaUrl.categorias,
  situacoes: filtrosNaUrl.situacoes,
  caminhos: filtrosNaUrl.caminhos,
  temas: filtrosNaUrl.temas,
});
