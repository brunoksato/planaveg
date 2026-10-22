import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";

import { servidorDeVersao as servidor } from "@/test/servidor-de-versao";

import { catalogoQuery } from "./catalogo.queries";

describe("versão dos dados nas consultas", () => {
  it("lê a versão numa consulta mínima e pede o catálogo já com ela", async () => {
    const { api, urls } = servidor();

    const catalogo = await new QueryClient().fetchQuery(catalogoQuery(api));

    const [leitura, tabelas] = urls;
    // Só a leitura da versão vai sem ela (fica um minuto na CDN, para uma base nova aparecer).
    expect(leitura?.searchParams.get("typeNames")).toBe("planaveg:fonte_vigente");
    expect(leitura?.searchParams.get("propertyName")).toBe("versao_dados");
    expect(leitura?.searchParams.has("v")).toBe(false);
    expect(tabelas?.searchParams.get("typeNames")).toContain("(planaveg:catalogo_ano)");
    expect(tabelas?.searchParams.get("v")).toBe("8f1c2a7b3d4e5f60");
    expect(urls).toHaveLength(2);
    // A versão lida volta com o catálogo: é ela que vai na chave das consultas de dados.
    expect(catalogo.versao).toBe("8f1c2a7b3d4e5f60");
  });

  it("durante a carga, sem base vigente, o catálogo e os dados seguem sem versão", async () => {
    const { api, urls, vigente } = servidor();
    vigente.splice(0);

    const catalogo = await new QueryClient().fetchQuery(catalogoQuery(api));
    await api.linhas("quantitativo_nivel");

    expect(catalogo.fonte).toBeNull();
    expect(urls.map((url) => url.searchParams.has("v"))).toEqual([false, false, false]);
  });

  it("a versão sai das consultas quando o catálogo é relido durante uma atualização", async () => {
    const { api, urls, vigente } = servidor();
    const cliente = new QueryClient();
    await cliente.fetchQuery(catalogoQuery(api));
    await api.linhas("quantitativo_nivel");

    // A atualização começou: a fonte_vigente vem sem versão, e o catálogo é relido.
    vigente.splice(0, 1, { versao_dados: null });
    await cliente.fetchQuery({ ...catalogoQuery(api), staleTime: 0 });
    await api.linhas("quantitativo_nivel");

    expect(urls.map((url) => url.searchParams.get("v"))).toEqual([
      null,
      "8f1c2a7b3d4e5f60",
      "8f1c2a7b3d4e5f60",
      null,
      null,
      null,
    ]);
  });
});
