import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AUSENTES } from "@/test/fixtures";
import { geoserverFixture, renderNaRota } from "@/test/utils";

import { DadosScreen } from "./DadosScreen";

describe("DadosScreen", () => {
  it("mostra nos metadados a fonte_ausente do GeoServer, por grupo", async () => {
    const { api } = geoserverFixture();
    renderNaRota(<DadosScreen geoserver={api} onSecaoChange={() => {}} secao="metadados" />);

    // Sem a lista, o bloco some sem aviso: é ele que mostra que a tabela chegou à tela.
    const bloco = within(
      await screen.findByRole("region", { name: "O que a base ainda não traz" }),
    );
    // Um título por grupo, e cada grupo fica onde aparece primeiro: as malhas, a última da lista,
    // sobem para junto das áreas prioritárias.
    const [monitorad, prioritarias, fitofisionomias, malhas] = AUSENTES;
    expect(bloco.getAllByRole("heading", { level: 4 })).toHaveLength(3);
    expect(bloco.getAllByRole("listitem").map((item) => item.textContent)).toEqual(
      [monitorad, prioritarias, malhas, fitofisionomias].map((fonte) => fonte?.descricao),
    );
  });
});
