import type { CatalogoCamada } from "@sinaveg/web-contracts";

/**
 * Atributos das áreas no CSV das camadas: tudo menos a geometria, com a situação do cadastro da
 * planilha de nomenclatura, e não as condições do CAR como a base as nomeia (`categoria`).
 */
export const ATRIBUTOS_DAS_AREAS = [
  "fid",
  "ano_vs",
  "nivel",
  "situacao_cadastro",
  "arranjo",
  "area_ha",
  "uf",
  "cod_municipio",
  "municipio",
  "bioma",
  "bacia",
  "sobreposicao",
];

/**
 * Nome da camada para leitura: "Áreas mapeadas · 2024", "Terras Indígenas · 2024". O título de
 * uma camada de filtro é o do relatório com o rótulo do ano (`Terras Indígenas — VS 2024`, em
 * `publicacao/camadas.py`); o ano vai do jeito das outras.
 */
export function nomeCamada(camada: CatalogoCamada): string {
  const ano = camada.ano_vs === null ? "todos os anos" : String(camada.ano_vs);
  // Não é o limite oficial: o arquivo não traz a malha municipal.
  if (camada.tipo === "municipio") return "Municípios: retângulo em volta das áreas de cada um";
  if (camada.tipo === "espacial" && camada.filtro !== null) {
    return `${camada.titulo.replace(/ — [^—]*$/u, "")} · ${ano}`;
  }
  return `Áreas mapeadas · ${ano}`;
}

/** O ano da camada: "2024"; na camada de todos os anos, "todos". */
export function anoDaCamada(camada: CatalogoCamada): string {
  return camada.ano_vs === null ? "todos" : String(camada.ano_vs);
}
