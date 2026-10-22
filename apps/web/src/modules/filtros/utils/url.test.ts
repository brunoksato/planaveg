import { describe, expect, it } from "vitest";

import type { Catalogo } from "@/shared/services/catalogo.service";
import { ANOS, ARRANJOS, FILTROS, NIVEIS } from "@/test/fixtures";

import { SEM_FILTROS } from "./filtros";
import {
  alternarNaUrl,
  filtrosDoEstado,
  filtrosParaUrl,
  limparNaUrl,
  tiposParaOMapa,
  tiposParaOPainel,
} from "./url";

const PADRAO = ["recooperar", "uc", "app", "rl"];

const CATALOGO: Catalogo = {
  anos: ANOS,
  ano: 2024,
  camadas: [],
  niveis: NIVEIS,
  arranjos: ARRANJOS,
  filtros: FILTROS,
  dimensoes: [],
  ausentes: [],
  fonte: null,
  versao: undefined,
};

describe("tipos de área marcados no mapa (nenhum é o padrão)", () => {
  it("leva os tipos de uma tela à outra: todos ou nenhum no mapa é o padrão do painel", () => {
    expect(tiposParaOPainel({ ...SEM_FILTROS, categorias: ["nenhum"] }, PADRAO)).toEqual([]);
    expect(tiposParaOPainel({ ...SEM_FILTROS, categorias: [...PADRAO] }, PADRAO)).toEqual([]);
    expect(tiposParaOPainel({ ...SEM_FILTROS, categorias: ["rl", "uc"] }, PADRAO)).toEqual([
      "rl",
      "uc",
    ]);
    // O padrão do painel (todos) vai explícito ao mapa, que abre sem nenhum.
    expect(tiposParaOMapa(SEM_FILTROS, PADRAO)).toEqual(PADRAO);
    expect(tiposParaOMapa({ ...SEM_FILTROS, categorias: ["rl"] }, PADRAO)).toEqual(["rl"]);
  });
});

describe("filtros na URL", () => {
  it("lê as condições do cadastro", () => {
    expect(filtrosDoEstado({ situacoes: "em_conformidade" }, CATALOGO).situacoes).toEqual([
      "em_conformidade",
    ]);
    expect(
      filtrosDoEstado({ situacoes: "nao_analisado,em_conformidade" }, CATALOGO).situacoes,
    ).toEqual(["nao_analisado", "em_conformidade"]);
  });

  it("lê só o que o catálogo conhece; estados e biomas passam como vieram", () => {
    const filtros = filtrosDoEstado(
      {
        categorias: "rl,xyz",
        situacoes: "nao_analisado,outra",
        caminhos: "app_rl_aur,nenhum",
        estados: "MT,ZZ",
        biomas: "Cerrado",
        temas: "embargo_recooperar,nao_existe",
      },
      CATALOGO,
    );
    expect(filtros).toEqual({
      categorias: ["rl"],
      situacoes: ["nao_analisado"],
      caminhos: ["app_rl_aur"],
      estados: ["MT", "ZZ"],
      biomas: ["Cerrado"],
      temas: ["embargo_recooperar"],
    });
  });

  it("lê só os três arranjos do plano: as demais áreas de projetos saem", () => {
    expect(filtrosDoEstado({ caminhos: "demais_areas,areas_publicas" }, CATALOGO).caminhos).toEqual(
      ["areas_publicas"],
    );
  });

  it("escreve os filtros de volta em ordem, e tira da URL o que fica vazio", () => {
    const filtros = { ...SEM_FILTROS, estados: ["PA", "MT"], temas: ["embargo_recooperar"] };
    expect(filtrosParaUrl(filtros)).toEqual({ estados: "MT,PA", temas: "embargo_recooperar" });
    expect(filtrosParaUrl(filtros, ["temas"])).toEqual({ temas: "embargo_recooperar" });
    expect(alternarNaUrl(filtros, "estados", "PA")).toEqual({ estados: "MT" });
    expect(alternarNaUrl({ ...SEM_FILTROS, estados: ["MT"] }, "estados", "MT")).toEqual({
      estados: undefined,
    });
    expect(limparNaUrl(["estados", "temas"])).toEqual({ estados: undefined, temas: undefined });
  });
});
