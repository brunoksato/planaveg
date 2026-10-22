import * as z from "zod/mini";

import { CHAVES_DOS_MAPAS_BASE } from "@sinaveg/cartography";

import { filtrosNaUrl } from "@/modules/filtros";
import { inteiroEntre, naBusca, numeroEntre, texto } from "@/shared/utils/parametros";

/**
 * Os parâmetros do mapa na URL: tudo o que muda a imagem é compartilhável por link. Cada um é
 * opcional; fora do formato, fica de fora, e a tela usa o padrão. O mapa mostra só a base mais
 * recente; um parâmetro que ele não conhece é ignorado.
 */
export const parametrosDoMapa = z.object({
  /**
   * Ordem dos tipos de área no mapa, de cima para baixo (a legenda); sem ela, a da hierarquia.
   * Os tipos marcados (`categorias`; sem ela, nenhum: a pessoa escolhe o que ver) são as camadas.
   * A tela confere os códigos com o catálogo.
   */
  ordem: naBusca(texto(/^[a-z_,]+$/, 500)),
  /** Filtros das áreas: em cada dimensão, os valores escolhidos, separados por vírgula. */
  ...filtrosNaUrl,
  /** A intensidade das cores, em %. */
  opacidade: naBusca(inteiroEntre(10, 100)),
  /** O fundo: um dos mapas base que o pacote do mapa define, a lista dele (nada escrito aqui). */
  mapaBase: naBusca(z.enum(CHAVES_DOS_MAPAS_BASE)),
  /** O município escolhido, pelo código do IBGE. */
  municipio: naBusca(texto(/^\d{7}$/)),
  /** A vista do mapa: o centro e o zoom. */
  longitude: naBusca(numeroEntre(-180, 180)),
  latitude: naBusca(numeroEntre(-90, 90)),
  zoom: naBusca(numeroEntre(0, 18)),
});
