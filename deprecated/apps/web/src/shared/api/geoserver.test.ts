import { describe, expect, it, vi } from "vitest";

import { HttpError } from "@sinaveg/web-contracts";

import { textoCql } from "./cql";
import { createGeoServerApi } from "./geoserver";

function resposta(corpo: unknown, { status = 200, tipo = "application/json" } = {}): Response {
  const texto = typeof corpo === "string" ? corpo : JSON.stringify(corpo);
  return new Response(texto, { status, headers: { "content-type": tipo } });
}

/**
 * A caixa da vista em metros do Web Mercator (EPSG:3857), como o mapa a manda: de -47,1° a -46,9°
 * de longitude e de -15,9° a -15,7° de latitude.
 */
const CAIXA_METROS = [-5243148.02, -1793145.1, -5220884.12, -1770006.98] as const;

function cliente(corpo: unknown = { features: [] }, opcoes?: { status?: number; tipo?: string }) {
  const fetcher = vi.fn<typeof fetch>().mockResolvedValue(resposta(corpo, opcoes));
  const api = createGeoServerApi("https://geo.test/geoserver/", "planaveg", fetcher);
  const pedido = (indice = 0) => new URL(String(fetcher.mock.calls[indice]?.[0]));
  return { api, fetcher, pedido };
}

describe("createGeoServerApi", () => {
  it("lê uma tabela por WFS 2.0 em GeoJSON, com filtro, colunas, ordem e limite", async () => {
    const { api, pedido } = cliente({
      features: [{ id: "quantitativo_nivel.1", properties: { nivel: "app", area_ha: 10 } }],
    });

    const linhas = await api.linhas<{ nivel: string; area_ha: number }>("quantitativo_nivel", {
      cql: "ano_vs = 2024",
      propriedades: ["nivel", "area_ha"],
      ordenarPor: "area_ha DESC, nivel",
      limite: 5,
    });

    expect(linhas).toEqual([{ nivel: "app", area_ha: 10 }]);
    const url = pedido();
    expect(url.origin + url.pathname).toBe("https://geo.test/geoserver/planaveg/ows");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      service: "WFS",
      version: "2.0.0",
      request: "GetFeature",
      typeNames: "planaveg:quantitativo_nivel",
      CQL_FILTER: "ano_vs = 2024",
      propertyName: "nivel,area_ha",
      sortBy: "area_ha D,nivel A",
      count: "5",
      outputFormat: "application/json",
    });
  });

  it("lê várias tabelas num pedido só, uma consulta por tabela, e agrupa pelo id", async () => {
    const { api, pedido } = cliente({
      features: [
        { id: "catalogo_ano.fid-1", properties: { ano_vs: 2022 } },
        { id: "catalogo_ano.fid-2", properties: { ano_vs: 2024 } },
        { id: "fonte_vigente.fid-3", properties: { pecas: 10 } },
      ],
    });

    const tabelas = await api.tabelas(["catalogo_ano", "fonte_vigente", "catalogo_filtro"]);

    expect(tabelas).toEqual({
      catalogo_ano: [{ ano_vs: 2022 }, { ano_vs: 2024 }],
      fonte_vigente: [{ pecas: 10 }],
      catalogo_filtro: [],
    });
    // `(a)(b)` são consultas separadas no WFS 2.0; `a,b` seria uma junção.
    expect(pedido().searchParams.get("typeNames")).toBe(
      "(planaveg:catalogo_ano)(planaveg:fonte_vigente)(planaveg:catalogo_filtro)",
    );
  });

  it("transforma o ExceptionReport que o GeoServer devolve com 200 em erro legível", async () => {
    const xml = `<?xml version="1.0"?><ows:ExceptionReport><ows:Exception><ows:ExceptionText>Illegal property name: nada</ows:ExceptionText></ows:Exception></ows:ExceptionReport>`;
    const { api } = cliente(xml, { tipo: "application/xml" });

    const erro = await api.linhas("serie").catch((e: unknown) => e);
    expect(erro).toBeInstanceOf(HttpError);
    expect(erro).toMatchObject({
      status: 502,
      message: "O GeoServer recusou a consulta: Illegal property name: nada",
    });
  });

  it("preserva o status HTTP quando o GeoServer falha", async () => {
    const { api } = cliente("fora do ar", { status: 503, tipo: "text/plain" });

    await expect(api.linhas("serie")).rejects.toMatchObject({
      status: 503,
      message: "O GeoServer não respondeu a esta consulta.",
    });
  });

  it("identifica só as peças que atendem o filtro do mapa", async () => {
    const { api, pedido } = cliente({ features: [] });

    await api.identificar(
      ["peca_2024"],
      { bbox: CAIXA_METROS, largura: 800, altura: 600, x: 400, y: 300 },
      { cql: "nivel IN ('rl') AND uf IN ('MT')" },
    );

    expect(pedido().searchParams.get("CQL_FILTER")).toBe("nivel IN ('rl') AND uf IN ('MT')");
    expect(pedido().searchParams.has("viewparams")).toBe(false);
  });

  it("trata um filtro vazio como nenhum, no clique, nos tiles e nas tabelas", async () => {
    const clique = cliente({ features: [] });
    const tabela = cliente({ features: [] });

    await clique.api.identificar(
      ["peca_2024"],
      { bbox: CAIXA_METROS, largura: 800, altura: 600, x: 400, y: 300 },
      { cql: "" },
    );
    await tabela.api.linhas("serie", { cql: "  " });

    // Sem isso, iria `CQL_FILTER=`, um filtro vazio na URL (e no cache dos tiles).
    expect(clique.pedido().searchParams.has("CQL_FILTER")).toBe(false);
    expect(tabela.pedido().searchParams.has("CQL_FILTER")).toBe(false);
    expect(clique.api.urlTiles("peca_2024", "planaveg_nivel", "v1", "")).not.toContain(
      "CQL_FILTER",
    );
  });

  it("manda os parâmetros da consulta dos polígonos de uma peça em viewparams", async () => {
    const { api, pedido } = cliente({ features: [] });

    await api.identificar(
      ["peca_parte"],
      { bbox: CAIXA_METROS, largura: 800, altura: 600, x: 400, y: 300 },
      { parametros: { ano_vs: 2024, origem_id: 14_537 }, limite: 1 },
    );

    expect(pedido().searchParams.get("viewparams")).toBe("ano_vs:2024;origem_id:14537");
    expect(pedido().searchParams.get("feature_count")).toBe("1");
  });

  it("monta o modelo de URL dos tiles prontos no cache do GeoServer (WMTS)", () => {
    const { api } = cliente();

    expect(api.urlTiles("peca_2024", "planaveg_arranjo", "19d6 9")).toBe(
      "https://geo.test/geoserver/gwc/service/wmts/rest/planaveg:peca_2024/planaveg:planaveg_arranjo" +
        "/EPSG:900913/EPSG:900913:{z}/{y}/{x}?format=image%2Fpng&v=19d6%209",
    );
    // Com filtro, o CQL vai na URL e o cache guarda cada filtro à parte.
    const filtrada = new URL(
      api
        .urlTiles("peca_2024", "planaveg_nivel", "v1", "bioma IN ('Amazônia')")
        .replace("{z}/{y}/{x}", "4/8/5"),
    );
    expect(filtrada.searchParams.get("CQL_FILTER")).toBe("bioma IN ('Amazônia')");
    expect(filtrada.searchParams.get("v")).toBe("v1");
  });

  it("sem a versão do mapa (base em atualização), os tiles vão sem `v=`", () => {
    const { api } = cliente();

    expect(api.urlTiles("peca_2024", "planaveg_nivel", undefined)).toBe(
      "https://geo.test/geoserver/gwc/service/wmts/rest/planaveg:peca_2024/planaveg:planaveg_nivel" +
        "/EPSG:900913/EPSG:900913:{z}/{y}/{x}?format=image%2Fpng",
    );
    const filtrada = new URL(
      api
        .urlTiles("peca_2024", "planaveg_nivel", undefined, "uf = 'GO'")
        .replace("{z}/{y}/{x}", "4/8/5"),
    );
    expect(filtrada.searchParams.has("v")).toBe(false);
    expect(filtrada.searchParams.get("CQL_FILTER")).toBe("uf = 'GO'");
  });
});

describe("versão dos dados nas URLs", () => {
  it("leva a versão em toda consulta, menos na que a lê", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockImplementation(() => Promise.resolve(resposta({ features: [] })));
    const api = createGeoServerApi("https://geo.test/geoserver/", "planaveg", fetcher);
    const pedido = (indice: number) => new URL(String(fetcher.mock.calls[indice]?.[0]));
    api.definirVersaoDosDados("8f1c2a7b3d4e5f60");

    await api.linhas("quantitativo_faceta", { cql: "ano_vs = 2024" });
    await api.feicoes("municipio", { limite: 1 });
    await api.identificar(["peca_2024"], {
      bbox: [-47, -14, -46, -13],
      largura: 800,
      altura: 600,
      x: 1,
      y: 2,
    });
    await api.linhas("fonte_vigente", { propriedades: ["versao_dados"], semVersao: true });
    await api.tabelas(["catalogo_ano", "fonte_vigente"], { versao: "1234" });

    expect([0, 1, 2].map((i) => pedido(i).searchParams.get("v"))).toEqual([
      "8f1c2a7b3d4e5f60",
      "8f1c2a7b3d4e5f60",
      "8f1c2a7b3d4e5f60",
    ]);
    // A consulta que lê a versão vai sem ela: com ela na URL, uma base nova nunca seria vista.
    expect(pedido(3).searchParams.has("v")).toBe(false);
    // O catálogo vai com a versão que acabou de ser lida.
    expect(pedido(4).searchParams.get("v")).toBe("1234");
    expect(new URL(api.urlDownload("peca_2024", "csv")).searchParams.get("v")).toBe(
      "8f1c2a7b3d4e5f60",
    );

    api.definirVersaoDosDados(undefined);
    expect(new URL(api.urlDownload("peca_2024", "csv")).searchParams.has("v")).toBe(false);
  });
});

describe("textoCql", () => {
  it("dobra as aspas simples do literal", () => {
    expect(textoCql("Pau d'Arco (PA)")).toBe("'Pau d''Arco (PA)'");
  });
});
