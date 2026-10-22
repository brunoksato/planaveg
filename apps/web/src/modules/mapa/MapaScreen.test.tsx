import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState, type Ref } from "react";
import { describe, expect, it, vi } from "vitest";

import type { CamadaMapa, CliqueMapa, Destaque, MapaWmsHandle } from "@sinaveg/cartography";

import type { GeoServerApi } from "@/shared/api/geoserver";
import { FONTE } from "@/test/fixtures";
import { geoserverFixture, QUADRADO_BONITO, QUADRADO_DA_PARTE, renderNaRota } from "@/test/utils";

import { MapaScreen } from "./MapaScreen";
import { type AlteracaoMapa, type EstadoMapa } from "./types";

const mapa = vi.hoisted(() => ({
  ajustarAosLimites: vi.fn<(caixa: readonly number[]) => void>(),
  redefinirVista: vi.fn<() => void>(),
  aproximar: vi.fn<() => void>(),
  afastar: vi.fn<() => void>(),
}));

/** O clique fixo dos testes. */
const CLIQUE: CliqueMapa = {
  // A caixa da vista em metros do Web Mercator, como o mapa a manda.
  consulta: {
    bbox: [-5187488.27, -1516914.45, -5165224.37, -1494027.46],
    largura: 800,
    altura: 600,
    x: 600,
    y: 300,
  },
};

/**
 * Todos os tipos de área do catálogo dos testes, como a URL do mapa os guarda. No mapa, o padrão
 * é nenhum: quem quer ver as áreas marca os tipos, e todos marcados vão explícitos na URL.
 */
const TODOS_OS_TIPOS = "app,recooperar,rl,uc";

/** O filtro dos tipos com todos marcados, que o clique e os downloads levam. */
const TODOS_NO_CQL = "nivel IN ('app', 'recooperar', 'rl', 'uc')";

/** As áreas de 2024 prontas no cache de tiles: todos os tipos marcados não filtram o desenho. */
const PECAS = "tiles:peca_2024:planaveg_nivel:19d69549e25bb122";

vi.mock("@sinaveg/cartography", async (importOriginal) => {
  const { useImperativeHandle } = await import("react");
  return {
    ...(await importOriginal<typeof import("@sinaveg/cartography")>()),
    MapaWms: (props: {
      camadas: readonly CamadaMapa[];
      destaque?: Destaque | null;
      mapaBase: string;
      onClique?: (clique: CliqueMapa) => void;
      onCarregando?: (carregando: boolean) => void;
      onErroCamada?: (id: string) => void;
      ref?: Ref<MapaWmsHandle>;
    }) => {
      useImperativeHandle(props.ref, () => mapa);
      return (
        <section aria-label="Mapa WMS simulado">
          <ol aria-label="Camadas WMS">
            {props.camadas.map((camada) =>
              camada.tipo === "tiles" ? (
                <li data-limites={camada.limites?.join(",")} key={camada.id}>
                  {camada.url}
                </li>
              ) : (
                <li key={camada.id}>{["wms", camada.nome, camada.cql ?? ""].join(" | ")}</li>
              ),
            )}
          </ol>
          <output data-destaque={JSON.stringify(props.destaque ?? null)} data-testid="destaque">
            {props.destaque?.type ?? "sem destaque"}
          </output>
          <output data-testid="mapa-base">{props.mapaBase}</output>
          <button onClick={() => props.onClique?.(CLIQUE)} type="button">
            Clicar no mapa
          </button>
          {/* O que o Leaflet avisa: tiles carregando e um tile que falhou. */}
          <button onClick={() => props.onCarregando?.(true)} type="button">
            Começar a carregar
          </button>
          <button onClick={() => props.onCarregando?.(false)} type="button">
            Terminar de carregar
          </button>
          <button onClick={() => props.onErroCamada?.("pecas")} type="button">
            Falhar um tile
          </button>
        </section>
      );
    },
  };
});

/** O estado vive aqui, como na rota: cada alteração entra (ou sai) da "URL". */
function MapaControlado({
  geoserver,
  inicial,
  onAlteracao,
}: {
  geoserver: GeoServerApi;
  inicial?: Partial<EstadoMapa>;
  onAlteracao?: (alteracao: AlteracaoMapa) => void;
}) {
  const [estado, setEstado] = useState<Partial<EstadoMapa>>(inicial ?? {});
  return (
    <MapaScreen
      estado={estado}
      geoserver={geoserver}
      onEstadoChange={(alteracao) => {
        onAlteracao?.(alteracao);
        setEstado(
          (atual) =>
            Object.fromEntries(
              Object.entries({ ...atual, ...alteracao }).filter(([, valor]) => valor !== undefined),
            ) as Partial<EstadoMapa>,
        );
      }}
    />
  );
}

/** A lista de um filtro das áreas (um `<details>`), pelo título. */
function listaDeFiltro(titulo: string): HTMLElement {
  const lista = screen.getByText(titulo, { selector: "summary span" }).closest("details");
  if (lista === null) throw new Error(`Lista de filtro sem <details>: ${titulo}`);
  return lista;
}

/** A legenda do mapa, aberta (em tela estreita, como a dos testes, ela começa fechada). */
async function legendaDoMapa() {
  const regiao = await screen.findByRole("region", { name: "Legenda do mapa" });
  const botao = within(regiao).getByRole("button", { name: /^Legenda/ });
  if (botao.getAttribute("aria-expanded") === "false") fireEvent.click(botao);
  return within(regiao);
}

function camadasWms(): string[] {
  return within(screen.getByRole("list", { name: "Camadas WMS" }))
    .queryAllByRole("listitem")
    .map((item) => item.textContent ?? "");
}

describe("MapaScreen", () => {
  it("marca os tipos na lista: cada um vira camada, e todos marcados não filtram nada", async () => {
    const user = userEvent.setup();
    const onAlteracao = vi.fn<(alteracao: AlteracaoMapa) => void>();
    const { api } = geoserverFixture();
    renderNaRota(<MapaControlado geoserver={api} onAlteracao={onAlteracao} />);

    await screen.findByRole("group", { name: "Filtrar áreas" });
    const tipos = within(listaDeFiltro("Tipo de área"));
    // Um tipo marcado vai à URL e é só parte das áreas: o mapa oferece o CSV delas. O aviso de
    // filtro, não: o tipo é a camada que a pessoa escolheu ver.
    await user.click(tipos.getByRole("checkbox", { name: /^Reserva Legal \(RL\)/ }));
    expect(onAlteracao).toHaveBeenLastCalledWith({ categorias: "rl" });
    expect(camadasWms()).toEqual([`${PECAS}|nivel IN ('rl')`]);
    expect(
      await screen.findByText(
        (_, el) =>
          el?.tagName === "P" && el.textContent === "Mostrando 4,5 milhões de ha em 300 polígonos.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText("Só as áreas filtradas")).not.toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Baixar as áreas filtradas (CSV)" }),
    ).toBeInTheDocument();

    // Os outros entram na URL em ordem; todos marcados ficam nela, porque o padrão é nenhum.
    await user.click(tipos.getByRole("checkbox", { name: /^Recooperar/ }));
    await user.click(tipos.getByRole("checkbox", { name: /^Unidades de Conservação/ }));
    await user.click(tipos.getByRole("checkbox", { name: /^Área de Preservação Permanente/ }));
    expect(onAlteracao).toHaveBeenLastCalledWith({ categorias: TODOS_OS_TIPOS });
    // Todos marcados não filtram nada: os tiles prontos do cache, sem aviso nem CSV de filtro.
    expect(camadasWms()).toEqual([PECAS]);
    expect(
      screen.getByText(
        (_, el) =>
          el?.tagName === "P" &&
          el.textContent === "Todas as áreas: 7,2 milhões de ha em 2,1 mil polígonos.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText("Só as áreas filtradas")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Baixar as áreas filtradas (CSV)" }),
    ).not.toBeInTheDocument();
    // A legenda sobre o mapa traz cada camada, de cima para baixo, na ordem da hierarquia.
    expect(
      (await legendaDoMapa())
        .getAllByRole("listitem")
        .map((item) => item.textContent?.replace(/, posição.*$/, "")),
    ).toEqual([
      "Recooperar",
      "Unidades de Conservação",
      "Área de Preservação Permanente (APP)",
      "Reserva Legal (RL)",
    ]);
  });

  // Enquanto a base é atualizada, a fonte_vigente vem sem versão (ou nem vem, durante a carga).
  // Nada de versão inventada: um tile com `v=` fica um ano em cache.
  it.each([
    ["com as versões nulas", [{ ...FONTE, versao_mapa: null, versao_dados: null }]],
    ["sem a base vigente", []],
  ])("pede os tiles sem versão enquanto a base é atualizada (%s)", async (_caso, fonte) => {
    const { api } = geoserverFixture({ tabelas: { fonte_vigente: fonte } });
    renderNaRota(<MapaControlado geoserver={api} inicial={{ categorias: TODOS_OS_TIPOS }} />);

    await screen.findByRole("heading", { name: "Vegetação em recuperação" });
    expect(camadasWms()).toEqual(["tiles:peca_2024:planaveg_nivel:"]);
  });

  it("filtra as áreas por tema e estado, com a área que sobra em cada valor", async () => {
    const user = userEvent.setup();
    const onAlteracao = vi.fn<(alteracao: AlteracaoMapa) => void>();
    const { api } = geoserverFixture();
    renderNaRota(
      <MapaControlado
        geoserver={api}
        inicial={{ categorias: TODOS_OS_TIPOS }}
        onAlteracao={onAlteracao}
      />,
    );

    const filtros = within(await screen.findByRole("group", { name: "Filtrar áreas" }));
    expect(
      await screen.findByText(
        (_, el) =>
          el?.tagName === "P" &&
          el.textContent === "Todas as áreas: 7,2 milhões de ha em 2,1 mil polígonos.",
      ),
    ).toBeInTheDocument();

    // Os temas ficam numa lista como as outras, com o nome inteiro; sem escolha, "Todos".
    const temas = listaDeFiltro("Temas do relatório");
    expect(within(temas).getByText("Todos")).toBeInTheDocument();
    const embargos = within(temas).getByRole("checkbox", {
      name: /^Áreas em recuperação por processos de Embargo \(Recooperar\)/,
    });
    await user.click(embargos);
    expect(onAlteracao).toHaveBeenLastCalledWith({ temas: "embargo_recooperar" });
    expect(embargos).toBeChecked();
    expect(screen.queryByRole("group", { name: "Atalhos por tema" })).not.toBeInTheDocument();
    // As áreas vêm do cache com o filtro na URL (cada filtro tem a sua entrada no cache); com
    // todos os tipos marcados, só o do tema.
    expect(camadasWms()).toEqual([`${PECAS}|(embargo = true)`]);
    expect(
      screen.getByText(
        (_, el) =>
          el?.tagName === "P" && el.textContent === "Mostrando 250 mil ha em 600 polígonos.",
      ),
    ).toBeInTheDocument();

    // Em cascata: com o tema ligado, só o Pará tem área; Mato Grosso fica sem nada a escolher.
    await user.click(filtros.getByText("Estado", { selector: "summary span" }));
    expect(filtros.getByRole("checkbox", { name: /^Mato Grosso/ })).toBeDisabled();
    await user.click(filtros.getByRole("checkbox", { name: /^Pará/ }));
    expect(onAlteracao).toHaveBeenLastCalledWith({ estados: "PA" });
    expect(camadasWms()).toEqual([`${PECAS}|uf IN ('PA') AND (embargo = true)`]);

    // O CSV leva o filtro inteiro, com os tipos marcados.
    const csv = new URL(
      screen.getByRole("link", { name: "Baixar as áreas filtradas (CSV)" }).getAttribute("href") ??
        "",
    );
    expect(csv.searchParams.get("typeNames")).toBe("planaveg:peca_2024");
    expect(csv.searchParams.get("CQL_FILTER")).toBe(
      `${TODOS_NO_CQL} AND uf IN ('PA') AND (embargo = true)`,
    );

    // Voltar ao padrão tira os filtros e os tipos: o mapa fica sem áreas.
    await user.click(screen.getByRole("button", { name: "Voltar ao padrão" }));
    expect(camadasWms()).toEqual([]);
    expect(screen.getByText("Nenhum tipo de área marcado.")).toBeInTheDocument();
  });

  it("filtra por tipo de área e condição do cadastro e identifica só o que o mapa mostra", async () => {
    const user = userEvent.setup();
    const onAlteracao = vi.fn<(alteracao: AlteracaoMapa) => void>();
    const { api, cliques } = geoserverFixture();
    renderNaRota(
      <MapaControlado
        geoserver={api}
        inicial={{ categorias: "app,rl", situacoes: "nao_analisado" }}
        onAlteracao={onAlteracao}
      />,
    );

    // Filtros que vêm do link já abrem as listas escolhidas.
    const filtros = within(await screen.findByRole("group", { name: "Filtrar áreas" }));
    expect(
      filtros.getByRole("checkbox", { name: /^Área de Preservação Permanente/ }),
    ).toBeChecked();
    // O CAR tem as duas condições da planilha: "não analisado ou em análise" junta os analisados e
    // os não analisados da base. "Habilitado" não aparece.
    expect(filtros.getByRole("checkbox", { name: /^Não analisado ou em análise/ })).toBeChecked();
    expect(filtros.getByRole("checkbox", { name: /^Analisado em conformidade/ })).not.toBeChecked();
    expect(screen.queryByText(/Habilitad/)).not.toBeInTheDocument();
    expect(camadasWms()).toEqual([
      `${PECAS}|nivel IN ('app', 'rl') AND categoria IN ('Analisados', 'Nao_Analisados')`,
    ]);
    expect(
      await screen.findByText(
        (_, el) =>
          el?.tagName === "P" && el.textContent === "Mostrando 891 mil ha em 600 polígonos.",
      ),
    ).toBeInTheDocument();
    // Os temas também seguem a cascata: nenhuma dessas áreas está numa Unidade de Conservação.
    expect(
      within(listaDeFiltro("Temas do relatório")).getByRole("checkbox", {
        name: /^Unidades de Conservação/,
      }),
    ).toBeDisabled();
    // Só os tipos marcados ficam na legenda do mapa.
    expect((await legendaDoMapa()).getAllByRole("listitem")).toHaveLength(2);

    await user.click(screen.getByRole("button", { name: "Clicar no mapa" }));
    // As peças vêm com o filtro do mapa; o polígono clicado, só pela peça.
    await waitFor(() => expect(cliques.at(-1)?.camadas).toEqual(["peca_parte"]));
    expect(cliques.at(-2)?.cql).toBe(
      "nivel IN ('app', 'rl') AND categoria IN ('Analisados', 'Nao_Analisados')",
    );
    expect(cliques.at(-1)?.cql).toBeUndefined();

    // Marcar a outra condição grava as duas, em ordem.
    await user.click(filtros.getByRole("checkbox", { name: /^Analisado em conformidade/ }));
    expect(onAlteracao).toHaveBeenLastCalledWith({ situacoes: "em_conformidade,nao_analisado" });
    expect(camadasWms()).toEqual([
      `${PECAS}|nivel IN ('app', 'rl') AND categoria IN ('Analisados', 'Habilitados', 'Nao_Analisados')`,
    ]);
  });

  it.each([
    ["sem o contorno dos municípios", {}, "BA"],
    ["com o GeoServer fora do ar", { falhar: ["municipio"] }, "MS"],
  ])("sem a caixa dos estados (%s), o mapa fica onde está", async (_caso, opcoes, estados) => {
    mapa.ajustarAosLimites.mockClear();
    const { api, consultas } = geoserverFixture(opcoes);
    renderNaRota(
      <MapaControlado geoserver={api} inicial={{ categorias: TODOS_OS_TIPOS, estados }} />,
    );

    await waitFor(() =>
      expect(consultas).toContainEqual(
        expect.objectContaining({ tabela: "municipio", cql: `uf IN ('${estados}')` }),
      ),
    );
    expect(mapa.ajustarAosLimites).not.toHaveBeenCalled();
    // O erro não chega à tela: o mapa continua com as áreas do filtro.
    expect(camadasWms()).toEqual([`${PECAS}|uf IN ('${estados}')`]);
  });

  it("identifica o polígono clicado, com a peça de que ele faz parte, e o contorna", async () => {
    const user = userEvent.setup();
    const { api, cliques } = geoserverFixture({ geometriaClicada: QUADRADO_BONITO });
    renderNaRota(<MapaControlado geoserver={api} inicial={{ categorias: TODOS_OS_TIPOS }} />);

    await user.click(await screen.findByRole("button", { name: "Clicar no mapa" }));

    const painel = await screen.findByRole("region", { name: "Áreas neste ponto" });
    // Os nomes da planilha de nomenclatura: a situação do cadastro é a condição dele.
    expect(
      await within(painel).findByText("Área de Preservação Permanente (APP)"),
    ).toBeInTheDocument();
    expect(within(painel).getByText("Analisado em conformidade")).toBeInTheDocument();
    expect(within(painel).queryByText(/Habilitad/)).not.toBeInTheDocument();
    expect(
      within(painel).getByText("Recuperação da vegetação nativa em APP, RL e AUR"),
    ).toBeInTheDocument();
    // A área é a do polígono clicado; a peça junta os 24 polígonos de mesmos dados.
    expect(within(painel).getByText("2,4 ha")).toBeInTheDocument();
    expect(
      within(painel).getByText(
        "É um de 24 polígonos com estes mesmos dados no município e na bacia, que somam 11,7 ha.",
      ),
    ).toBeInTheDocument();
    expect(within(painel).getByText("São Domingos (GO)")).toBeInTheDocument();
    expect(within(painel).getByText("Cerrado · Paranã")).toBeInTheDocument();
    expect(within(painel).getByText("imóvel do CAR, assentamento")).toBeInTheDocument();
    // Fora de Unidade de Conservação, nada sobre UC.
    expect(within(painel).queryByText("Unidade de Conservação")).not.toBeInTheDocument();
    // O contorno é o do polígono clicado, não o da peça inteira.
    const destaque = screen.getByTestId("destaque");
    expect(destaque).toHaveTextContent("FeatureCollection");
    expect(JSON.parse(destaque.dataset.destaque ?? "null")).toMatchObject({
      features: [{ geometry: QUADRADO_DA_PARTE }],
    });
    expect(cliques).toEqual([
      {
        camadas: ["peca_2024"],
        propriedades: expect.arrayContaining(["fid", "origem_id"]),
        // A peça vem com o filtro do mapa: os tipos marcados.
        cql: TODOS_NO_CQL,
        limite: 5,
      },
      // Os polígonos de uma peça só respondem com a peça na URL.
      {
        camadas: ["peca_parte"],
        propriedades: ["parte", "partes", "area_ha", "geom"],
        parametros: { ano_vs: 2024, origem_id: 11_980 },
        limite: 1,
      },
    ]);

    await user.click(within(painel).getByRole("button", { name: "Fechar" }));
    expect(screen.queryByRole("region", { name: "Áreas neste ponto" })).not.toBeInTheDocument();
    expect(screen.getByTestId("destaque")).toHaveTextContent("sem destaque");
  });

  it("sem o polígono clicado, mostra a peça inteira e diz que a área é a soma", async () => {
    const user = userEvent.setup();
    // O clique pegou o ponto de uma peça pequena demais para a escala: nenhum polígono ali.
    const { api } = geoserverFixture({ geometriaClicada: QUADRADO_BONITO, parteClicada: null });
    renderNaRota(<MapaControlado geoserver={api} inicial={{ categorias: TODOS_OS_TIPOS }} />);

    await user.click(await screen.findByRole("button", { name: "Clicar no mapa" }));

    const painel = await screen.findByRole("region", { name: "Áreas neste ponto" });
    expect(await within(painel).findByText("11,7 ha")).toBeInTheDocument();
    expect(
      within(painel).getByText(
        "Soma de todos os polígonos com estes mesmos dados no município e na bacia.",
      ),
    ).toBeInTheDocument();
    expect(JSON.parse(screen.getByTestId("destaque").dataset.destaque ?? "null")).toMatchObject({
      features: [{ geometry: QUADRADO_BONITO }],
    });
  });

  it.each([
    ["nenhum tipo marcado", {}],
    ["todos os tipos marcados", { categorias: TODOS_OS_TIPOS }],
  ])("leva o lugar e os filtros do mapa ao painel (%s)", async (_caso, tipos) => {
    const { api } = geoserverFixture();
    renderNaRota(
      <MapaControlado
        geoserver={api}
        inicial={{
          ...tipos,
          estados: "PA",
          situacoes: "nao_analisado",
          temas: "embargo_recooperar",
        }}
      />,
    );

    const link = await screen.findByRole("link", { name: "Ver os números no painel" });
    const url = new URL(link.getAttribute("href") ?? "", "https://portal.test");
    expect(url.pathname).toBe("/painel");
    // O único estado filtrado vira o lugar do painel, sem ano: as duas telas mostram a base mais
    // recente. Nenhum ou todos os tipos são todos no painel.
    expect(Object.fromEntries(url.searchParams)).toEqual({
      dimensao: "uf",
      chave: "PA",
      situacoes: "nao_analisado",
      temas: "embargo_recooperar",
    });
  });

  it("diz quando não conseguiu consultar o ponto, em vez de dizer que não há área", async () => {
    const user = userEvent.setup();
    const { api } = geoserverFixture({ falhar: ["peca_2024"] });
    renderNaRota(<MapaControlado geoserver={api} inicial={{ categorias: TODOS_OS_TIPOS }} />);

    await user.click(await screen.findByRole("button", { name: "Clicar no mapa" }));

    const painel = within(await screen.findByRole("region", { name: "Áreas neste ponto" }));
    expect(
      await painel.findByText(
        "Não foi possível consultar as áreas deste ponto: peca_2024 indisponível",
      ),
    ).toBeInTheDocument();
    expect(painel.queryByText(/Nenhuma área contabilizada/)).not.toBeInTheDocument();
  });

  it("um clique novo cancela a consulta do anterior", async () => {
    const user = userEvent.setup();
    const { api } = geoserverFixture();
    const sinais: AbortSignal[] = [];
    let respostas = 0;
    const rastreado: typeof api = {
      ...api,
      identificar: async (camadas, consulta, opcoes = {}) => {
        if (opcoes.signal !== undefined) sinais.push(opcoes.signal);
        // O primeiro clique fica sem resposta; o segundo responde na hora.
        respostas += 1;
        if (respostas === 1) await new Promise(() => undefined);
        return api.identificar(camadas, consulta, opcoes);
      },
    };
    renderNaRota(<MapaControlado geoserver={rastreado} inicial={{ categorias: TODOS_OS_TIPOS }} />);

    await user.click(await screen.findByRole("button", { name: "Clicar no mapa" }));
    await user.click(screen.getByRole("button", { name: "Clicar no mapa" }));

    const painel = within(await screen.findByRole("region", { name: "Áreas neste ponto" }));
    expect(await painel.findByText("2,4 ha")).toBeInTheDocument();
    // O pedido do primeiro clique foi cancelado; os do segundo, não.
    expect(sinais[0]?.aborted).toBe(true);
    expect(sinais.slice(1).every((sinal) => !sinal.aborted)).toBe(true);
    // Fechar o painel cancela também o pedido que ainda corre.
    await user.click(painel.getByRole("button", { name: "Fechar" }));
    expect(sinais.at(-1)?.aborted).toBe(true);
  });
});
