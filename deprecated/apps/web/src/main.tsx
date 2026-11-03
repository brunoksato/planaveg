import { QueryClientProvider } from "@tanstack/react-query";
import { createBrowserHistory, RouterProvider } from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import "@/index.css";
import { geoserverUrl, geoserverWorkspace } from "@/app/env";
import { criarQueryClient } from "@/app/query-client";
import { createWebRouter } from "@/app/router";
import { createGeoServerApi } from "@/shared/api/geoserver";

const container = document.querySelector("#root");
if (container === null) {
  throw new Error("Raiz do portal público não encontrada.");
}

// O portal só fala com o GeoServer: se ele está em outro domínio, abre a conexão (DNS, TCP, TLS)
// antes do primeiro pedido. Tiles (imagens) e WFS (fetch com CORS) usam conexões separadas, então
// vão as duas dicas. No mesmo domínio (produção), a conexão já está aberta.
const origemGeoserver = new URL(geoserverUrl).origin;
if (origemGeoserver !== window.location.origin) {
  for (const crossOrigin of [null, "anonymous"]) {
    const dica = document.createElement("link");
    dica.rel = "preconnect";
    dica.href = origemGeoserver;
    if (crossOrigin !== null) dica.crossOrigin = crossOrigin;
    document.head.append(dica);
  }
}

const queryClient = criarQueryClient();
const router = createWebRouter(
  { geoserver: createGeoServerApi(geoserverUrl, geoserverWorkspace) },
  createBrowserHistory(),
  { scrollRestoration: true },
);

createRoot(container).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
);
