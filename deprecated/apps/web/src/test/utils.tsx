import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { render, type RenderResult } from "@testing-library/react";
import type { ReactElement } from "react";

import type { AtributosPeca, PartePeca } from "@sinaveg/web-contracts";

import type { Feicao, GeoServerApi, Geometria, OpcoesWfs } from "@/shared/api/geoserver";
import { escreverBusca } from "@/shared/utils/parametros";

import { PARTE_CLICADA, PECA_CLICADA } from "./fixtures";
import { colunas, consultar, MUNICIPIOS, QUADRADO_DA_PARTE, TABELAS } from "./geoserver";

export { QUADRADO_BONITO, QUADRADO_DA_PARTE } from "./geoserver";

function renderComConsultas(elemento: ReactElement): RenderResult {
  const cliente = new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
  });
  return render(<QueryClientProvider client={cliente}>{elemento}</QueryClientProvider>);
}

/** Monta a tela como a única rota de um roteador de teste, para os links dela funcionarem. */
export function renderNaRota(elemento: ReactElement): RenderResult {
  const raiz = createRootRoute({ component: () => elemento });
  const router = createRouter({
    routeTree: raiz,
    history: createMemoryHistory({ initialEntries: ["/"] }),
    // A URL escrita como no portal, sem aspas.
    stringifySearch: escreverBusca,
  });
  return renderComConsultas(<RouterProvider router={router} />);
}

type OpcoesFixture = {
  /**
   * A geometria simplificada da peça clicada (a `geom_alta` do GeoServer), que o mapa pede pelo
   * WFS quando o clique não acha o polígono.
   */
  geometriaClicada?: Geometria | null;
  /** Atributos que mudam na peça clicada (por exemplo, dentro de uma UC). */
  pecaClicada?: Partial<AtributosPeca>;
  /**
   * O que muda no polígono clicado da peça (`peca_parte`, com a geometria `QUADRADO_DA_PARTE`);
   * `null`, nenhum polígono sob o clique (o ponto de uma peça pequena demais para a escala).
   */
  parteClicada?: Partial<PartePeca> | null;
  /**
   * Tabelas e camadas que respondem com erro, como um GeoServer fora do ar (no clique também:
   * `peca_2024` ou `peca_parte`).
   */
  falhar?: readonly string[];
  /** Substitui tabelas (ex.: muitos municípios, para a busca ir ao servidor). */
  tabelas?: Record<string, readonly object[]>;
};

/**
 * `GeoServerApi` falso sobre as tabelas de `geoserver.ts`. Cada consulta fica registrada em
 * `consultas`; cada clique no mapa, em `cliques`.
 */
export function geoserverFixture(opcoes: OpcoesFixture = {}) {
  const consultas: Array<{ tabela: string } & OpcoesWfs> = [];
  const cliques: Array<{
    camadas: readonly string[];
    propriedades?: readonly string[];
    cql?: string | undefined;
    parametros?: Readonly<Record<string, number>>;
  }> = [];
  const falhar = new Set(opcoes.falhar ?? []);
  const tabelas = { ...TABELAS, ...opcoes.tabelas };
  const pecaClicada = { ...PECA_CLICADA, ...opcoes.pecaClicada };
  // As feições de cada camada: a peça clicada responde pelas camadas de peças do ano.
  const feicoesDe = (camada: string): Feicao<object>[] =>
    camada === "municipio"
      ? MUNICIPIOS
      : camada.startsWith("peca_")
        ? [
            {
              id: `${camada}.1`,
              propriedades: pecaClicada,
              geometria: opcoes.geometriaClicada ?? null,
            },
          ]
        : [];

  function responder<T>(
    tabela: string,
    linhas: readonly T[],
    wfs: OpcoesWfs,
    valores: (l: T) => object,
  ) {
    consultas.push({ tabela, ...wfs });
    if (falhar.has(tabela)) return Promise.reject(new Error(`${tabela} indisponível`));
    return Promise.resolve(consultar(linhas, wfs, valores));
  }

  const api: GeoServerApi = {
    urlWms: "https://geo.test/geoserver/planaveg/wms",
    urlOws: "https://geo.test/geoserver/planaveg/ows",
    workspace: "planaveg",
    camada: (nome) => `planaveg:${nome}`,
    // Legível nos testes: `tiles:<camada>:<estilo>:<versão>` (sem versão, nada depois do `:`).
    // Com filtro, o CQL depois de `|`: `tiles:<camada>:<estilo>:<versão>|<cql>`.
    urlTiles: (camada, estilo, versao, cql) =>
      `tiles:${camada}:${estilo}:${versao ?? ""}${cql === undefined ? "" : `|${cql}`}`,
    linhas: async <P,>(tabela: string, wfs: OpcoesWfs = {}) => {
      const linhas = await responder(tabela, tabelas[tabela] ?? [], wfs, (l) => l);
      return linhas.map((linha) => colunas(linha, wfs.propriedades)) as P[];
    },
    tabelas: async (nomes) => {
      const linhas = await Promise.all(
        nomes.map((nome) => responder(nome, tabelas[nome] ?? [], {}, (l) => l)),
      );
      return Object.fromEntries(nomes.map((nome, i) => [nome, linhas[i] ?? []]));
    },
    feicoes: <P,>(camada: string, wfs: OpcoesWfs = {}) =>
      responder<Feicao<object>>(camada, feicoesDe(camada), wfs, (f) => f.propriedades) as Promise<
        Feicao<P>[]
      >,
    identificar: <P,>(
      camadas: readonly string[],
      _consulta: unknown,
      {
        signal: _sinal,
        ...extra
      }: {
        propriedades?: readonly string[];
        cql?: string | undefined;
        parametros?: Readonly<Record<string, number>>;
        signal?: AbortSignal;
      } = {},
    ) => {
      // O que o clique perguntou; o `signal` (o cancelamento) fica de fora.
      cliques.push({ camadas, ...extra });
      const camada = camadas[0] ?? "";
      if (falhar.has(camada)) return Promise.reject(new Error(`${camada} indisponível`));
      if (camada === "peca_parte") {
        if (opcoes.parteClicada === null) return Promise.resolve([]);
        return Promise.resolve([
          {
            camada,
            propriedades: { ...PARTE_CLICADA, ...opcoes.parteClicada } as P,
            geometria: QUADRADO_DA_PARTE,
          },
        ]);
      }
      // A peça vem sem geometria: o clique não pede a `geom_alta`.
      return Promise.resolve([{ camada, propriedades: pecaClicada as P, geometria: null }]);
    },
    definirVersaoDosDados: () => undefined,
    urlDownload: (tabela, formato, wfs = {}) => {
      const params = new URLSearchParams({
        typeNames: `planaveg:${tabela}`,
        outputFormat: formato,
      });
      if (wfs.cql !== undefined) params.set("CQL_FILTER", wfs.cql);
      if (wfs.propriedades !== undefined) params.set("propertyName", wfs.propriedades.join(","));
      return `https://geo.test/geoserver/planaveg/ows?${params.toString()}`;
    },
  };
  return { api, consultas, cliques };
}
