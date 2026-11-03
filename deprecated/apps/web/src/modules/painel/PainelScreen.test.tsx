import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import type { GeoServerApi } from "@/shared/api/geoserver";
import { geoserverFixture, renderNaRota } from "@/test/utils";

import { PainelScreen } from "./PainelScreen";
import { type AlteracaoPainel, type EstadoPainel } from "./types";

function PainelControlado({
  geoserver,
  inicial,
  onAlteracao,
}: {
  geoserver: GeoServerApi;
  inicial?: Partial<EstadoPainel>;
  onAlteracao?: (alteracao: AlteracaoPainel) => void;
}) {
  const [estado, setEstado] = useState<Partial<EstadoPainel>>(inicial ?? {});
  return (
    <PainelScreen
      estado={estado}
      geoserver={geoserver}
      onEstadoChange={(alteracao) => {
        onAlteracao?.(alteracao);
        setEstado(
          (atual) =>
            Object.fromEntries(
              Object.entries({ ...atual, ...alteracao }).filter(([, valor]) => valor !== undefined),
            ) as Partial<EstadoPainel>,
        );
      }}
    />
  );
}

function figura(nome: string | RegExp) {
  return within(screen.getByRole("figure", { name: nome }));
}

/** O parágrafo com este texto, mesmo dividido em partes (número e unidade de um indicador). */
function paragrafo(texto: string) {
  return (_: string, el: Element | null) =>
    el?.tagName === "P" && el.textContent?.replace(/\s+/g, " ").trim() === texto;
}

function secao(nome: string | RegExp) {
  return within(screen.getByRole("region", { name: nome }));
}

describe("PainelScreen", () => {
  it("resume o Brasil em indicadores: a área, a meta e os dois grupos com as fontes", async () => {
    const { api } = geoserverFixture();
    renderNaRota(<PainelControlado geoserver={api} />);

    expect(await screen.findByRole("heading", { level: 1, name: "Brasil" })).toBeInTheDocument();
    // Só a base mais recente, sem escolher o ano nem dizer qual é.
    expect(screen.queryByRole("button", { name: "2024" })).not.toBeInTheDocument();
    // 107.092,9 + 1.340.832,3 + 1.241.547,2 (APP nas três situações) + 4.489.443,3
    const resumo = within(
      await screen.findByRole("region", { name: "Vegetação nativa em recuperação" }),
    );
    expect(resumo.getByText(paragrafo("7,2 milhões de ha"))).toBeInTheDocument();
    expect(resumo.queryByText(/2022|2024/)).not.toBeInTheDocument();
    // O painel conta polígonos, como o mapa (7 facetas de 300 polígonos no ano).
    expect(resumo.getByText("2.100 polígonos")).toBeInTheDocument();
    expect(resumo.queryByText(/áreas mapeadas/)).not.toBeInTheDocument();
    expect(resumo.getByText("Estimativa técnica")).toBeInTheDocument();
    // Sem o texto que explicava a soma: a revisão do MMA o tirou.
    expect(resumo.queryByText(/^Soma a vegetação nativa/)).not.toBeInTheDocument();
    // A meta nacional é a soma das metas dos arranjos (2 + 9 + 1 milhões de ha).
    expect(resumo.getByText("Meta de 2030")).toBeInTheDocument();
    expect(resumo.getByText("de 12 milhões de ha")).toBeInTheDocument();
    // As duas categorias de saída do relatório, os grupos da planilha de nomenclatura, cada uma
    // com as fontes: as que a base não traz dizem isso, e APP, AUR e RL são uma linha só.
    expect(resumo.getByText("99% do total")).toBeInTheDocument();
    const fontes = (nome: string) =>
      within(resumo.getByRole("list", { name: nome }))
        .getAllByRole("listitem")
        .map((item) => item.textContent);
    expect(fontes("Fontes de projetos de recuperação da vegetação nativa")).toEqual([
      "Recooperar107 mil ha",
      "MonitoRADsem dados",
    ]);
    expect(fontes("Fontes de vegetação secundária em áreas legalmente protegidas")).toEqual([
      "Unidades de Conservação1,3 milhão de ha",
      "Área de Preservação Permanente (APP) / Reserva Legal (RL)5,7 milhões de ha",
    ]);

    // Cartões com título curto, sem pergunta; os dois grupos também na rosca.
    const tipos = secao("Tipos de área");
    const criterios = figura("Área por critério");
    expect(
      criterios.getByText("Vegetação secundária em áreas legalmente protegidas"),
    ).toBeInTheDocument();
    expect(criterios.getByText("7,1 milhões de ha")).toBeInTheDocument();

    // As categorias com os nomes da planilha de nomenclatura, em cada grupo.
    const categorias = figura("Área por categoria");
    expect(
      categorias.getByText("Vegetação secundária em áreas legalmente protegidas"),
    ).toBeInTheDocument();
    expect(categorias.getByText("Área de Preservação Permanente (APP)")).toBeInTheDocument();
    expect(categorias.getByText("1,2 milhão de ha")).toBeInTheDocument();
    // O número exato fica na dica; o nome do relatório, só quando é outro (a sigla não conta).
    expect(
      categorias.getByTitle("Área de Preservação Permanente (APP): 1.241.547 ha (17%)"),
    ).toBeInTheDocument();
    // Categoria sem dados na base não vira barra zerada: vai numa nota.
    expect(categorias.queryByText(/MonitoRAD/)).not.toBeInTheDocument();
    expect(tipos.getByText("Sem dados nesta base: MonitoRAD.")).toBeInTheDocument();

    // No Brasil sem filtros, o progresso de cada um dos três arranjos até a meta de 2030, com o
    // nome da revisão do MMA e a legenda da tabela dos arranjos: os critérios de elegibilidade e
    // o atributo espacial.
    const metas = secao("Metas de 2030 por arranjo de implementação");
    const progresso = within(
      metas.getByRole("list", { name: "Progresso de cada arranjo até a meta" }),
    );
    expect(progresso.getAllByRole("heading", { level: 3 }).map((h) => h.textContent)).toEqual([
      "Recuperação da vegetação nativa em áreas públicas",
      "Recuperação da vegetação nativa em APP, RL e AUR",
      "Recuperação da vegetação em áreas rurais consolidadas com sistemas integrados de produção",
    ]);
    expect(progresso.getAllByText("Critérios de elegibilidade")).toHaveLength(3);
    expect(progresso.getByText("Cadastro Ambiental Rural (APP; RL; AUR)")).toBeInTheDocument();
    // O terceiro fica zerado por enquanto, e o cartão diz por quê (o motivo vem do catálogo).
    expect(
      progresso.getByText("Fica zerado por enquanto: a base não traz as técnicas."),
    ).toBeInTheDocument();
    // O que sobra dos três não tem caixa: uma nota diz quanto é.
    expect(
      metas.getByText(
        /^Demais áreas de projetos: .+ \(1,5%\), fora dos três arranjos e sem meta própria\.$/,
      ),
    ).toBeInTheDocument();
    expect(
      metas.getByText(/^Estimativa técnica\. Metas do Planaveg para 2030 \(Figura 4/),
    ).toBeInTheDocument();
  });

  it("divide APP, AUR e RL pelas duas condições do cadastro no CAR", async () => {
    const { api } = geoserverFixture();
    renderNaRota(<PainelControlado geoserver={api} />);

    const imoveis = within(
      await screen.findByRole("region", { name: "Imóveis rurais: situação do cadastro no CAR" }),
    );
    // (142.856,8 + 748.169,1) dos 5.730.990,5 ha de APP e RL.
    expect(imoveis.getByText("16%")).toBeInTheDocument();
    expect(imoveis.getByText("em cadastros não analisados ou em análise")).toBeInTheDocument();
    // As duas condições da planilha de nomenclatura: a base junta "analisado" e "não analisado"
    // na segunda, e o termo "habilitado", que o relatório não usa, sai.
    const car = figura("Imóveis rurais por situação do cadastro");
    expect(
      within(car.getByRole("list", { name: "Legenda" })).getByText("Analisado em conformidade"),
    ).toBeVisible();
    expect(
      car.getByTitle(
        "Área de Preservação Permanente (APP) · Analisado em conformidade: 350.521 ha (28%)",
      ),
    ).toBeInTheDocument();
    expect(
      car.getByTitle(
        "Área de Preservação Permanente (APP) · Não analisado ou em análise: 891.026 ha (72%)",
      ),
    ).toBeInTheDocument();
    expect(car.getByText("1,2 milhão de ha")).toBeInTheDocument();
    expect(screen.queryByText(/[Hh]abilitado/)).not.toBeInTheDocument();
    // As situações do imóvel que a tabela de critérios conta em cada condição.
    const situacoes = (nome: string) =>
      within(imoveis.getByRole("list", { name: nome })).getAllByRole("listitem");
    expect(situacoes("Analisado em conformidade")).toHaveLength(4);
    expect(situacoes("Não analisado ou em análise")).toHaveLength(1);
    expect(imoveis.getByText(/SIGEF e SNCI\), pela metodologia do Anexo 4$/)).toBeInTheDocument();
  });

  it("filtra o painel pelos temas do mapa e leva os filtros ao mapa", async () => {
    const user = userEvent.setup();
    const onAlteracao = vi.fn<(alteracao: AlteracaoPainel) => void>();
    const { api } = geoserverFixture();
    renderNaRota(<PainelControlado geoserver={api} onAlteracao={onAlteracao} />);

    // Os filtros ficam na lateral, como no mapa.
    const lateral = within(
      await screen.findByRole("complementary", { name: "Escolhas do painel" }),
    );
    const filtros = within(lateral.getByRole("group", { name: "Filtrar áreas" }));
    await user.click(
      filtros.getByRole("checkbox", {
        name: /^Áreas em recuperação por processos de Embargo \(Recooperar\)/,
      }),
    );
    expect(onAlteracao).toHaveBeenLastCalledWith({ temas: "embargo_recooperar" });

    // O número principal e todos os assuntos respondem só pelas áreas do tema.
    const resumo = within(screen.getByRole("region", { name: "Vegetação nativa em recuperação" }));
    expect(resumo.getByText(paragrafo("250 mil ha"))).toBeInTheDocument();
    // Com filtro, sem meta: as metas valem para o Brasil inteiro, sem filtros.
    expect(resumo.queryByText("Meta de 2030")).not.toBeInTheDocument();
    expect(
      secao("Arranjos de implementação").getByText(/As metas são nacionais/),
    ).toBeInTheDocument();
    expect(resumo.getByText("Só as áreas filtradas: 3,5% dos 7,2 milhões de ha.")).toBeVisible();
    const categorias = figura("Área por categoria");
    expect(categorias.getByText("Recooperar")).toBeInTheDocument();
    expect(categorias.queryByText("Reserva Legal (RL)")).not.toBeInTheDocument();
    expect(
      figura("Imóveis rurais por situação do cadastro").getByTitle(
        "Área de Preservação Permanente (APP) · Não analisado ou em análise: 142.857 ha (100%)",
      ),
    ).toBeInTheDocument();
    // Só o Pará tem embargos: uma lista de um estado só não aparece.
    expect(screen.queryByRole("region", { name: "Estados com mais área" })).not.toBeInTheDocument();

    const mapa = new URL(
      screen.getByRole("link", { name: "Ver no mapa" }).getAttribute("href") ?? "",
      "https://portal.test",
    );
    expect(mapa.pathname).toBe("/mapa");
    // O mapa abre sem tipos marcados: o link leva os do painel, todos quando ele não filtra.
    expect(Object.fromEntries(mapa.searchParams)).toEqual({
      categorias: "app,recooperar,rl,uc",
      temas: "embargo_recooperar",
    });

    await user.click(screen.getByRole("button", { name: "Voltar ao padrão" }));
    expect(onAlteracao).toHaveBeenLastCalledWith({
      categorias: undefined,
      situacoes: undefined,
      caminhos: undefined,
      temas: undefined,
    });
    expect(await resumo.findByText(paragrafo("7,2 milhões de ha"))).toBeInTheDocument();
  });

  it("abre um município pelas facetas dele, com todos os assuntos", async () => {
    const { api, consultas } = geoserverFixture();
    renderNaRota(
      <PainelControlado geoserver={api} inicial={{ dimensao: "municipio", chave: "1500602" }} />,
    );

    expect(
      await screen.findByRole("heading", { level: 1, name: "Altamira (PA)" }),
    ).toBeInTheDocument();
    expect(consultas).toContainEqual(
      expect.objectContaining({
        tabela: "quantitativo_faceta_lugar",
        cql: "dimensao = 'municipio' AND chave = '1500602' AND ano_vs = 2024",
      }),
    );
    expect(
      (
        await screen.findByRole("figure", {
          name: "Imóveis rurais por situação do cadastro",
        })
      ).querySelector(
        '[title="Área de Preservação Permanente (APP) · Não analisado ou em análise: 40.000 ha (100%)"]',
      ),
    ).not.toBeNull();
    expect(
      figura("Projetos de recuperação por processo").getByText("Embargos"),
    ).toBeInTheDocument();
    // Um só estado e um só bioma: sem essas listas.
    expect(screen.queryByRole("region", { name: "Estados com mais área" })).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Biomas" })).not.toBeInTheDocument();
    // Num lugar, sem progresso da meta (ela é nacional): os arranjos, com o porquê.
    expect(
      secao("Arranjos de implementação").getByText(/As metas são nacionais/),
    ).toBeInTheDocument();

    // No mapa, o município vai como o do mapa, sem aspas.
    const mapa = new URL(
      screen.getByRole("link", { name: "Ver no mapa" }).getAttribute("href") ?? "",
      "https://portal.test",
    );
    expect(mapa.searchParams.get("municipio")).toBe("1500602");
  });

  it("explica a falha sem ficar carregando para sempre", async () => {
    const { api } = geoserverFixture({ falhar: ["quantitativo_faceta"] });
    renderNaRota(<PainelControlado geoserver={api} />);

    expect(
      await screen.findByText(
        "Não foi possível ler os quantitativos: quantitativo_faceta indisponível",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText("Somando as áreas…")).not.toBeInTheDocument();
  });

  it("baixa a tabela de cada assunto como está na tela, com o lugar e os filtros", async () => {
    const { api } = geoserverFixture();
    renderNaRota(<PainelControlado geoserver={api} inicial={{ situacoes: "em_conformidade" }} />);

    const link = await screen.findByRole("link", {
      name: "Baixar os dados por tipo de área (CSV)",
    });
    expect(link).toHaveAttribute("download", "painel-tipos-de-area-brasil-filtrado-2024.csv");
    const href = link.getAttribute("href") ?? "";
    expect(href.startsWith("data:text/csv;charset=utf-8,")).toBe(true);
    const linhas = decodeURIComponent(href.slice(href.indexOf(",") + 1)).split("\r\n");
    // UTF-8 com BOM, para a planilha abrir os acentos.
    expect(linhas[0]).toBe("\uFEFFano,lugar,filtros,codigo,nome,criterio,area_ha,do_total");
    // Só as áreas filtradas: o total é o dos cadastros analisados em conformidade.
    expect(linhas).toContain(
      "2024,Brasil,situação do cadastro: Analisado em conformidade,rl,Reserva Legal (RL)," +
        "Vegetação secundária em áreas legalmente protegidas,4489443.3,0.9276",
    );
  });
});
