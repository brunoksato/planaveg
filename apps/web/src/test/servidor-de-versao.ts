import { vi } from "vitest";

import { createGeoServerApi } from "@/shared/api/geoserver";

/**
 * Um GeoServer que responde pela tabela pedida e guarda as URLs, na ordem. `vigente` são as
 * linhas da `fonte_vigente`, que o teste pode trocar no meio (uma atualização da base começou, ou
 * uma base nova entrou).
 */
export function servidorDeVersao(versao: string | null = "8f1c2a7b3d4e5f60") {
  const urls: URL[] = [];
  const vigente: Array<{ versao_dados: string | null }> = [{ versao_dados: versao }];
  const fetcher = vi.fn<typeof fetch>().mockImplementation((entrada) => {
    const url = new URL(String(entrada));
    urls.push(url);
    const tipos = url.searchParams.get("typeNames") ?? "";
    const features = tipos.includes("fonte_vigente")
      ? vigente.map((properties, i) => ({ id: `fonte_vigente.${String(i + 1)}`, properties }))
      : [];
    return Promise.resolve(
      new Response(JSON.stringify({ features }), {
        headers: { "content-type": "application/json" },
      }),
    );
  });
  const api = createGeoServerApi("https://geo.test/geoserver", "planaveg", fetcher);
  return { api, urls, vigente };
}
