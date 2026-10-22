import { describe, expect, it } from "vitest";

import { QUANTITATIVO_FACETA } from "@/test/fixtures";

import {
  MAIS_DE_UMA,
  prepararFacetas,
  resumir,
  SEM_ESFERA,
  totaisPorValor,
  totalFiltrado,
  type Total,
} from "./facetas";
import { SEM_FILTROS, temFiltros, type FiltrosAreas } from "./filtros";

const LINHAS_2024 = prepararFacetas(QUANTITATIVO_FACETA.filter((l) => l.ano_vs === 2024));

function filtros(parcial: Partial<FiltrosAreas>): FiltrosAreas {
  return { ...SEM_FILTROS, ...parcial };
}

describe("facetas do mapa", () => {
  it("sem filtro, soma todas as áreas do ano (o mesmo total do painel)", () => {
    expect(temFiltros(SEM_FILTROS)).toBe(false);
    const total = totalFiltrado(LINHAS_2024, SEM_FILTROS);
    expect(total.area).toBeCloseTo(7_178_915.7, 1);
    // Cada peça junta vários polígonos: o mapa conta os polígonos, que é o que se vê.
    expect(total.poligonos).toBe(2_100);
  });

  it("soma valores da mesma dimensão (OU) e cruza dimensões diferentes (E)", () => {
    const so = filtros({ estados: ["MT"], categorias: ["app", "rl"] });

    expect(temFiltros(so)).toBe(true);
    // APP habilitado (Cerrado) + APP não analisado + RL habilitado, todos em MT.
    expect(totalFiltrado(LINHAS_2024, so).area).toBeCloseTo(350_521.3 + 748_169.1 + 4_489_443.3, 1);
  });

  it("conta cada valor com os filtros das outras dimensões, em cascata", () => {
    const so = filtros({ estados: ["PA"], categorias: ["uc"] });

    // Estados: só o filtro de categoria vale (UC em MT e no PA).
    const estados = totaisPorValor(LINHAS_2024, so, "estados");
    expect(estados.get("MT")?.area).toBeCloseTo(1_000_000, 1);
    expect(estados.get("PA")?.area).toBeCloseTo(340_832.3, 1);
    // Categorias: só o filtro de estado vale (o que existe no PA).
    const categorias = totaisPorValor(LINHAS_2024, so, "categorias");
    expect([...categorias.keys()].toSorted()).toEqual(["app", "recooperar", "uc"]);
    expect(categorias.get("rl")).toBeUndefined();
  });

  it("filtra por tema pelas listas de cada linha, e a situação do CAR só existe no CAR", () => {
    const embargo = filtros({ temas: ["embargo_recooperar"] });
    expect(totalFiltrado(LINHAS_2024, embargo).area).toBeCloseTo(107_092.9 + 142_856.8, 1);

    // As três situações da base viram as duas condições do cadastro da planilha.
    const situacoes = totaisPorValor(LINHAS_2024, SEM_FILTROS, "situacoes");
    expect([...situacoes.keys()].toSorted()).toEqual(["em_conformidade", "nao_analisado"]);
    expect(situacoes.get("nao_analisado")?.area).toBeCloseTo(142_856.8 + 748_169.1, 1);
    expect(
      totalFiltrado(LINHAS_2024, filtros({ situacoes: ["em_conformidade"] })).area,
    ).toBeCloseTo(350_521.3 + 4_489_443.3, 1);
  });

  it("resume o lugar por assunto do painel, com o mesmo total de quantitativo_nivel", () => {
    const resumo = resumir(LINHAS_2024, SEM_FILTROS);

    expect(resumo.total.area).toBeCloseTo(7_178_915.7, 1);
    // O painel conta polígonos, como o mapa.
    expect(resumo.total.poligonos).toBe(2_100);
    expect(resumo.porNivel.get("app")).toBeCloseTo(350_521.3 + 142_856.8 + 748_169.1, 1);
    expect(resumo.porArranjo.get("app_rl_aur")).toBeCloseTo(1_241_547.2 + 4_489_443.3, 1);
    expect(Object.fromEntries(resumo.porCondicao.get("app") ?? [])).toEqual({
      em_conformidade: 350_521.3,
      nao_analisado: expect.closeTo(142_856.8 + 748_169.1, 1),
    });
    expect(resumo.porBioma.get("Cerrado")?.area).toBeCloseTo(340_832.3 + 350_521.3, 1);
    expect(resumo.porUf.get("MT")?.area).toBeCloseTo(6_588_133.7, 1);
    expect(resumo.porUf.get("PA")?.area).toBeCloseTo(590_782.0, 1);
    // Unidades de Conservação: a área dentro delas, pela esfera e pelo tipo.
    expect(resumo.ucs).toEqual({ area: 1_000_000 + 340_832.3, poligonos: 600 });
    expect(resumo.porEsferaUc.get("federal")?.area).toBeCloseTo(1_000_000, 1);
    expect(resumo.porEsferaUc.get("estadual")?.area).toBeCloseTo(340_832.3, 1);
    expect(resumo.porTipoUc.get("apa")?.area).toBeCloseTo(340_832.3, 1);
    expect(resumo.porTipoUc.get("outras")?.area).toBeCloseTo(1_000_000, 1);
  });

  it("põe a área em UCs de duas esferas numa parte à parte, e as partes somam as UCs", () => {
    const linha = (esferas: string[], tipos: string[], area: number) => ({
      ano_vs: 2024,
      nivel: "uc",
      categoria: null,
      arranjo: null,
      uf: "MT",
      bioma: "Amazônia",
      temas: ["unidade_conservacao"],
      esferas_uc: esferas,
      tipos_uc: tipos,
      n_pecas: 1,
      n_poligonos: 1,
      area_ha: area,
    });
    const resumo = resumir(
      [
        linha(["federal", "estadual"], ["apa", "outras"], 10),
        linha(["estadual"], ["apa"], 5),
        // Uma UC sem esfera no arquivo também tem a parte dela.
        linha([], ["rppn"], 2),
        linha([], [], 100),
      ],
      SEM_FILTROS,
    );
    expect(resumo.ucs).toEqual({ area: 17, poligonos: 3 });
    const areas = (mapa: ReadonlyMap<string, Total>) =>
      Object.fromEntries([...mapa].map(([chave, total]) => [chave, total.area]));
    expect(areas(resumo.porEsferaUc)).toEqual({
      [MAIS_DE_UMA]: 10,
      estadual: 5,
      [SEM_ESFERA]: 2,
    });
    expect(areas(resumo.porTipoUc)).toEqual({ [MAIS_DE_UMA]: 10, apa: 5, rppn: 2 });
  });
});
