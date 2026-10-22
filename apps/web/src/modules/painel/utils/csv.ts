import type { ContextoCsv } from "../types";

/**
 * O link do CSV de um cartão. Quase sempre é uma tabela do painel como está na tela, montada no
 * navegador (`tabelaCsv`: com filtro, o GeoServer não tem essa tabela pronta) e baixada como
 * `data:` URI, em UTF-8 com BOM para planilhas. As linhas levam o contexto que o arquivo precisa
 * para se explicar sozinho, nas colunas que cabem: o ano, e o lugar e os filtros quase sempre
 * (`csvDoPainel`; as metas, que só aparecem sem filtro, não têm `filtros`). Sem `arquivo`, o link
 * é de outro servidor, com o nome dele.
 */
export type Csv = {
  href: string;
  rotulo: string;
  /** Nome do arquivo baixado; sem ele, o do servidor. */
  arquivo?: string | undefined;
};

type Celula = string | number | null;

/** O BOM do UTF-8 no começo do arquivo, para a planilha abrir os acentos. */
const BOM = "\uFEFF";

export function tabelaCsv(
  rotulo: string,
  arquivo: string,
  colunas: readonly string[],
  linhas: ReadonlyArray<readonly Celula[]>,
): Csv {
  const texto = [colunas, ...linhas].map((linha) => linha.map(celula).join(",")).join("\r\n");
  return {
    rotulo,
    arquivo: `${arquivo}.csv`,
    href: `data:text/csv;charset=utf-8,${encodeURIComponent(`${BOM}${texto}\r\n`)}`,
  };
}

/**
 * O CSV de um assunto do painel com o contexto inteiro: o ano, o lugar e os filtros antes das
 * colunas de cada linha, e o arquivo `painel-<assunto>-<arquivo>-<ano>`.
 */
export function csvDoPainel(
  contexto: ContextoCsv,
  assunto: string,
  rotulo: string,
  colunas: readonly string[],
  linhas: ReadonlyArray<readonly Celula[]>,
): Csv {
  return tabelaCsv(
    rotulo,
    `painel-${assunto}-${contexto.arquivo}-${contexto.ano}`,
    ["ano", "lugar", "filtros", ...colunas],
    linhas.map((linha) => [contexto.ano, contexto.lugar, contexto.filtros, ...linha]),
  );
}

/** Números com até 4 casas, ponto decimal; texto entre aspas quando precisa. */
function celula(valor: Celula): string {
  if (valor === null) return "";
  if (typeof valor === "number") return String(Math.round(valor * 10_000) / 10_000);
  return /[",\r\n]/.test(valor) ? `"${valor.replaceAll('"', '""')}"` : valor;
}

/** "Mato Grosso" → "mato-grosso", para o nome do arquivo. */
export function semAcento(texto: string): string {
  return texto
    .normalize("NFD")
    .replaceAll(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("pt-BR")
    .replaceAll(/[^a-z0-9]+/g, "-")
    .replaceAll(/^-|-$/g, "");
}
