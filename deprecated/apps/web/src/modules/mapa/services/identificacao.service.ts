import type { CliqueMapa } from "@sinaveg/cartography";
import type { AtributosPeca, PartePeca } from "@sinaveg/web-contracts";

import type { GeoServerApi, Geometria } from "@/shared/api/geoserver";

import type { PoligonoClicado } from "../types";
import { PROPRIEDADES_PARTE, PROPRIEDADES_PECA } from "../utils/constantes";

/** Até quantas áreas o clique mostra. */
const LIMITE_DO_CLIQUE = 5;

/**
 * As peças de uma camada sob o clique, com o filtro do mapa, sem a geometria. Um erro (o
 * GeoServer fora do ar) chega a quem chamou: não é o mesmo que nenhuma peça ali.
 */
export async function identificarPecas(
  api: GeoServerApi,
  camada: string,
  consulta: CliqueMapa["consulta"],
  cql: string | undefined,
  signal?: AbortSignal,
): Promise<AtributosPeca[]> {
  const resultado = await api.identificar<AtributosPeca>([camada], consulta, {
    propriedades: PROPRIEDADES_PECA,
    limite: LIMITE_DO_CLIQUE,
    cql,
    ...(signal === undefined ? {} : { signal }),
  });
  return resultado.map((r) => r.propriedades);
}

/**
 * O polígono clicado de uma peça: a peça junta todos os polígonos com os mesmos atributos no
 * município e na bacia, e `peca_parte` responde só os dela sob o clique. Sem polígono ali (o
 * clique pegou o ponto de uma peça pequena demais para a escala), nenhum.
 *
 * Um erro também dá nenhum, de propósito, ao contrário das peças: a peça já veio, e sem o
 * polígono o painel mostra a peça inteira, com a área dela e a linha que diz que é uma soma. Com
 * a consulta de `peca_parte` fora do ar, o clique continua mostrando as peças.
 */
export async function identificarPoligono(
  api: GeoServerApi,
  peca: Pick<AtributosPeca, "ano_vs" | "origem_id">,
  consulta: CliqueMapa["consulta"],
  signal?: AbortSignal,
): Promise<PoligonoClicado | null> {
  const resultado = await api
    .identificar<Pick<PartePeca, "parte" | "partes" | "area_ha">>(["peca_parte"], consulta, {
      propriedades: PROPRIEDADES_PARTE,
      parametros: { ano_vs: peca.ano_vs, origem_id: peca.origem_id },
      limite: 1,
      ...(signal === undefined ? {} : { signal }),
    })
    .catch(() => []);
  const [parte] = resultado;
  return parte === undefined ? null : { ...parte.propriedades, geometria: parte.geometria };
}

/**
 * A geometria simplificada do mapa (`geom_alta`) de uma peça, para o contorno da peça inteira
 * quando o clique não acha o polígono. Pelo ano e pelo `origem_id`, que o índice do desenho acha
 * (o `fid` é calculado na view). Um erro dá nenhuma, como o polígono: a peça já veio, só fica
 * sem contorno.
 */
export async function geometriaDaPeca(
  api: GeoServerApi,
  camada: string,
  peca: Pick<AtributosPeca, "ano_vs" | "origem_id">,
  signal?: AbortSignal,
): Promise<Geometria | null> {
  const [feicao] = await api
    .feicoes(camada, {
      cql: `ano_vs = ${String(peca.ano_vs)} AND origem_id = ${String(peca.origem_id)}`,
      propriedades: ["geom_alta"],
      limite: 1,
      signal,
    })
    .catch(() => []);
  return feicao?.geometria ?? null;
}
