import type { MunicipioBusca } from "@sinaveg/web-contracts";

import type { Feicao, Geometria, OpcoesWfs } from "@/shared/api/geoserver";

import {
  ANOS,
  ARRANJOS,
  AUSENTES,
  buscaDe,
  CAMADAS,
  DIMENSOES,
  FILTROS,
  FONTE,
  NIVEIS,
  QUANTITATIVO_ARRANJO,
  QUANTITATIVO_DIMENSAO,
  QUANTITATIVO_FACETA,
  QUANTITATIVO_FACETA_LUGAR,
  QUANTITATIVO_FILTRO,
  QUANTITATIVO_NIVEL,
} from "./fixtures";

/**
 * O pedaço do GeoServer que o portal usa, em memória: as tabelas do workspace `planaveg` e o
 * subconjunto de WFS das consultas (ECQL com `=`, `IS NULL`, `IN` e `LIKE` ligados por `AND`,
 * `sortBy`, `count` e `propertyName`).
 */

export const TABELAS: Readonly<Record<string, readonly object[]>> = {
  catalogo_ano: ANOS,
  catalogo_camada: CAMADAS,
  catalogo_nivel: NIVEIS,
  catalogo_arranjo: ARRANJOS,
  catalogo_filtro: FILTROS,
  catalogo_dimensao: DIMENSOES,
  fonte_ausente: AUSENTES,
  fonte_vigente: [FONTE],
  quantitativo_nivel: QUANTITATIVO_NIVEL,
  quantitativo_arranjo: QUANTITATIVO_ARRANJO,
  quantitativo_filtro: QUANTITATIVO_FILTRO,
  quantitativo_dimensao: QUANTITATIVO_DIMENSAO,
  quantitativo_faceta: QUANTITATIVO_FACETA,
  quantitativo_faceta_lugar: QUANTITATIVO_FACETA_LUGAR,
};

export const QUADRADO_BONITO: Geometria = {
  type: "Polygon",
  coordinates: [
    [
      [-56.9, -21.5],
      [-56.4, -21.5],
      [-56.4, -20.9],
      [-56.9, -20.9],
      [-56.9, -21.5],
    ],
  ],
};

/** O polígono clicado (`peca_parte`), pequeno, dentro do quadrado de Bonito. */
export const QUADRADO_DA_PARTE: Geometria = {
  type: "Polygon",
  coordinates: [
    [
      [-56.61, -21.21],
      [-56.6, -21.21],
      [-56.6, -21.2],
      [-56.61, -21.2],
      [-56.61, -21.21],
    ],
  ],
};

export const MUNICIPIOS: Feicao<MunicipioBusca>[] = [
  {
    id: "municipio.1",
    propriedades: {
      cod_municipio: "5002209",
      municipio: "Bonito",
      uf: "MS",
      rotulo: "Bonito (MS)",
      busca: buscaDe("Bonito (MS)"),
    },
    geometria: QUADRADO_BONITO,
  },
  {
    id: "municipio.2",
    propriedades: {
      cod_municipio: "2900108",
      municipio: "Abaíra",
      uf: "BA",
      rotulo: "Abaíra (BA)",
      busca: buscaDe("Abaíra (BA)"),
    },
    geometria: null,
  },
];

/** Filtra, ordena e corta as linhas como o WFS faria; `valores` lê os atributos de cada uma. */
export function consultar<T>(
  linhas: readonly T[],
  wfs: Pick<OpcoesWfs, "cql" | "ordenarPor" | "limite">,
  valores: (linha: T) => object,
): T[] {
  let resultado = linhas.filter((linha) => atende(valores(linha), wfs.cql));
  if (wfs.ordenarPor !== undefined) resultado = ordenar(resultado, wfs.ordenarPor, valores);
  if (wfs.limite !== undefined) resultado = resultado.slice(0, wfs.limite);
  return resultado;
}

/** Como o `propertyName` do WFS: só as colunas pedidas voltam. */
export function colunas(linha: object, nomes: readonly string[] | undefined): object {
  if (nomes === undefined) return linha;
  return Object.fromEntries(Object.entries(linha).filter(([coluna]) => nomes.includes(coluna)));
}

function ordenar<T>(linhas: readonly T[], ordem: string, valores: (linha: T) => object): T[] {
  const criterios = ordem.split(",").map((parte) => {
    const [coluna = "", sentido = "ASC"] = parte.trim().split(/\s+/);
    return { coluna, fator: sentido.toUpperCase().startsWith("D") ? -1 : 1 };
  });
  return linhas.toSorted((a, b) => {
    for (const { coluna, fator } of criterios) {
      const x = (valores(a) as Record<string, unknown>)[coluna];
      const y = (valores(b) as Record<string, unknown>)[coluna];
      if (x === y) continue;
      if (typeof x === "number" && typeof y === "number") return (x - y) * fator;
      return String(x).localeCompare(String(y), "pt-BR") * fator;
    }
    return 0;
  });
}

function atende(linha: object, cql: string | undefined): boolean {
  if (cql === undefined || cql.trim() === "") return true;
  const valores = linha as Record<string, unknown>;
  // `AND` em maiúsculas, como o portal escreve: um termo de busca (em minúsculas) não o divide.
  return cql.split(/\s+AND\s+/).every((bruta) => {
    const condicao = bruta.trim();
    const nulo = /^(\w+) IS NULL$/i.exec(condicao);
    if (nulo !== null) {
      const valor = valores[nulo[1] ?? ""];
      return valor === null || valor === undefined;
    }
    const lista = /^(\w+) IN \((.*)\)$/i.exec(condicao);
    if (lista !== null) {
      const opcoes = (lista[2] ?? "").split(",").map((v) => v.trim().replace(/^'|'$/g, ""));
      return opcoes.includes(String(valores[lista[1] ?? ""]));
    }
    const parecido = /^(\w+) LIKE '(.*)'$/.exec(condicao);
    if (parecido !== null) {
      const padrao = comoExpressao((parecido[2] ?? "").replaceAll("''", "'"));
      return padrao.test(String(valores[parecido[1] ?? ""] ?? ""));
    }
    const igual = /^(\w+) = (?:'(.*)'|(-?\d+(?:\.\d+)?))$/.exec(condicao);
    if (igual !== null) return String(valores[igual[1] ?? ""]) === (igual[2] ?? igual[3]);
    throw new Error(`ECQL que o GeoServer falso não entende: ${condicao}`);
  });
}

/**
 * O padrão de um `LIKE` como expressão regular, como o GeoServer o aplica: `%` é qualquer texto,
 * `_` é um caractere, e o resto vale como está, com maiúsculas e minúsculas diferentes.
 */
function comoExpressao(padrao: string): RegExp {
  const partes = [...padrao].map((c) =>
    c === "%" ? ".*" : c === "_" ? "." : c.replaceAll(/[.*+?^${}()|[\]\\]/g, "\\$&"),
  );
  return new RegExp(`^${partes.join("")}$`, "su");
}
