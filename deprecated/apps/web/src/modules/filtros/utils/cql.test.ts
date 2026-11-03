import { describe, expect, it } from "vitest";

import { cqlDosFiltros } from "./cql";
import { SEM_FILTROS, type FiltrosAreas } from "./filtros";

function filtros(parcial: Partial<FiltrosAreas>): FiltrosAreas {
  return { ...SEM_FILTROS, ...parcial };
}

const TEMAS = new Map([
  ["embargo_recooperar", "(embargo = true)"],
  ["unidade_conservacao", "(uc = true OR apa = true OR rppn = true)"],
]);

describe("CQL dos filtros", () => {
  it("monta o CQL com os valores em ordem, para o mesmo filtro cair no mesmo cache", () => {
    expect(cqlDosFiltros(SEM_FILTROS, TEMAS)).toBeUndefined();
    const cql = cqlDosFiltros(
      filtros({
        estados: ["PA", "MT"],
        biomas: ["Mata Atlântica"],
        situacoes: ["nao_analisado"],
        temas: ["unidade_conservacao", "embargo_recooperar", "inexistente"],
      }),
      TEMAS,
    );
    // A condição do cadastro vira as situações da base que ela junta.
    expect(cql).toBe(
      "categoria IN ('Analisados', 'Nao_Analisados') AND uf IN ('MT', 'PA') AND " +
        "bioma IN ('Mata Atlântica') AND " +
        "((embargo = true) OR (uc = true OR apa = true OR rppn = true))",
    );
    expect(cqlDosFiltros(filtros({ temas: ["embargo_recooperar"] }), TEMAS)).toBe(
      "(embargo = true)",
    );
    expect(cqlDosFiltros(filtros({ estados: ["D'Ávila"] }), TEMAS)).toBe("uf IN ('D''Ávila')");
  });
});
