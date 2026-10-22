import { createFileRoute } from "@tanstack/react-router";

import { VisaoGeralScreen } from "@/modules/visao-geral";

export const Route = createFileRoute("/")({
  component: Rota,
});

function Rota() {
  const { geoserver } = Route.useRouteContext();
  return <VisaoGeralScreen geoserver={geoserver} />;
}
