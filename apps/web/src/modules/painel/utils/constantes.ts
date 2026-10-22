import { MAIS_DE_UMA, type Processo, SEM_ESFERA } from "@/modules/filtros";
import { PALETA } from "@/shared/components/graficos/cores";
import { type CondicaoCar, nomeCondicaoCar } from "@/shared/utils/glossario";

/** As duas condições do cadastro no CAR (APP, AUR e RL): as duas primeiras cores da paleta. */
export const CONDICOES = [
  { chave: "em_conformidade", rotulo: nomeCondicaoCar("em_conformidade"), cor: PALETA[0] },
  { chave: "nao_analisado", rotulo: nomeCondicaoCar("nao_analisado"), cor: PALETA[1] },
] as const;

/**
 * As situações do imóvel no CAR que a tabela de critérios do Planaveg conta nas APP, AUR e RL,
 * em cada uma das duas condições do cadastro da planilha de nomenclatura.
 */
export const CONDICOES_DO_CAR: Readonly<Record<CondicaoCar, readonly string[]>> = {
  em_conformidade: [
    "Analisado, aguardando regularização ambiental (Lei nº 12.651/2012)",
    "Analisado, em conformidade com a Lei nº 12.651/2012, e analisado sem pendências",
    "Analisado, em conformidade com a Lei nº 12.651/2012, com ativos ambientais",
    "Analisado em regularização",
  ],
  nao_analisado: [
    '"Aguardando análise", "Em análise" e "Aguardando retificação", desde que conformes aos dados fundiários do INCRA (SIGEF e SNCI), pela metodologia do Anexo 4',
  ],
};

/** Níveis do CAR divididos pela situação do cadastro. */
export const NIVEIS_CAR = ["app", "aur", "rl"] as const;

/** A menor área que aparece como barra: o que arredonda para 0,1 ha. */
export const AREA_MINIMA_HA = 0.05;

/**
 * Cor de cada processo dos projetos: as quatro primeiras da paleta categórica, em ordem,
 * escolhidas para se distinguirem também com daltonismo. O amarelo e o verde-água ficam abaixo de
 * 3:1 de contraste com o fundo: por isso a rosca escreve o nome e o percentual, e a cor não
 * carrega a informação sozinha.
 */
export const COR_PROCESSO: Readonly<Record<Processo, string>> = {
  embargo: PALETA[0],
  reparacao: PALETA[1],
  licenciamento: PALETA[2],
  outros: PALETA[3],
};

/** O cinza das partes que não são uma categoria: mais de uma esfera, fora dos limites. */
const COR_NEUTRA = "#4b5563";

/**
 * Os biomas na rosca, sempre nesta ordem e com estas cores (a da floresta, a do cerrado…), para
 * a cor seguir o bioma em qualquer lugar. As vizinhas passam no teste de daltonismo.
 */
export const BIOMAS: ReadonlyArray<{ chave: string; cor: string }> = [
  { chave: "Amazônia", cor: PALETA[5] },
  { chave: "Cerrado", cor: PALETA[3] },
  { chave: "Mata Atlântica", cor: PALETA[2] },
  { chave: "Caatinga", cor: PALETA[1] },
  { chave: "Pantanal", cor: PALETA[0] },
  { chave: "Pampa", cor: PALETA[4] },
];

/** A cor de um bioma fora da lista (`FORA`, ou um que a base passe a trazer). */
export const COR_OUTRO_BIOMA = COR_NEUTRA;

/** Estados na lista antes de "mostrar todos". */
export const ESTADOS_INICIAIS = 10;

/** Bacias no cartão do Brasil; as outras ficam na lista de bacias, com a busca. */
export const BACIAS_INICIAIS = 10;

/** As 12 regiões hidrográficas cabem no cartão, sem "ver todas". */
export const REGIOES_INICIAIS = 12;

/** Até quantos valores o ranking de um recorte mostra (municípios são 5 mil). */
export const RANKING_MAXIMO = 25;

/**
 * Esferas e tipos das Unidades de Conservação, na ordem de leitura, com as cores das roscas. Os
 * tipos usam outras cores que as esferas, para a mesma cor não dizer duas coisas no cartão.
 */
export const ESFERAS_UC = [
  { chave: "federal", cor: PALETA[0] },
  { chave: "estadual", cor: PALETA[1] },
  { chave: "municipal", cor: PALETA[2] },
  { chave: MAIS_DE_UMA, cor: COR_NEUTRA },
  { chave: SEM_ESFERA, cor: "#9aa5a0" },
] as const;

export const TIPOS_UC = [
  { chave: "apa", cor: PALETA[3] },
  { chave: "rppn", cor: PALETA[4] },
  { chave: "outras", cor: PALETA[5] },
  { chave: MAIS_DE_UMA, cor: COR_NEUTRA },
] as const;
