import { createFileRoute } from "@tanstack/react-router";

import { DadosScreen, parametrosDosDados } from "@/modules/dados";

export const Route = createFileRoute("/dados")({
  validateSearch: parametrosDosDados,
  component: Rota,
});

function Rota() {
  const { geoserver } = Route.useRouteContext();
  const { secao } = Route.useSearch();
  const navegar = Route.useNavigate();
  return (
    <DadosScreen
      geoserver={geoserver}
      onSecaoChange={(nova) => {
        void navegar({ search: nova === undefined ? {} : { secao: nova } });
      }}
      secao={secao}
    />
  );
}
