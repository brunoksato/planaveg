import { useQuery } from "@tanstack/react-query";
import { useRouteContext } from "@tanstack/react-router";

import { catalogoQuery } from "@/shared/services/catalogo.queries";

import { PortalShell } from "./PortalShell";

/**
 * A casca de todas as telas. O catálogo serve a todas elas: começa a carregar com a casca. Lê só
 * o GeoServer do contexto: o contexto inteiro é outro objeto a cada navegação (mover o mapa muda
 * a busca), e a casca seria refeita a cada movimento.
 */
export function AppShell() {
  const geoserver = useRouteContext({ from: "__root__", select: (contexto) => contexto.geoserver });
  useQuery(catalogoQuery(geoserver));
  return <PortalShell />;
}
