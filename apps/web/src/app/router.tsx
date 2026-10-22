import { createRouter, type RouterHistory } from "@tanstack/react-router";

import { routeTree } from "@/routeTree.gen";
import type { GeoServerApi } from "@/shared/api/geoserver";
import { escreverBusca } from "@/shared/utils/parametros";

/** O portal só fala com o GeoServer do planaveg_core. */
export type WebContext = {
  geoserver: GeoServerApi;
};

export function createWebRouter(
  context: WebContext,
  history?: RouterHistory,
  opcoes: { scrollRestoration?: boolean } = {},
) {
  return createRouter({
    routeTree,
    context,
    ...(history !== undefined ? { history } : {}),
    defaultPreload: "intent",
    // Os textos vão à URL sem aspas (`?municipio=5002209`).
    stringifySearch: escreverBusca,
    scrollRestoration: opcoes.scrollRestoration ?? false,
  });
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof createWebRouter>;
  }
}
