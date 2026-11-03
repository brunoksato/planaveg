import { createFileRoute } from "@tanstack/react-router";

import { MapaScreen, parametrosDoMapa } from "@/modules/mapa";

export const Route = createFileRoute("/mapa")({
  validateSearch: parametrosDoMapa,
  component: Rota,
});

function Rota() {
  const { geoserver } = Route.useRouteContext();
  const estado = Route.useSearch();
  const navegar = Route.useNavigate();
  return (
    <MapaScreen
      estado={estado}
      geoserver={geoserver}
      onEstadoChange={(alteracao) => {
        void navegar({
          // Só os parâmetros que o mapa conhece voltam à URL (o roteador guarda também os
          // brutos); os que voltaram ao padrão (`undefined`) saem dela.
          search: (atual) => ({ ...parametrosDoMapa.parse(atual), ...alteracao }),
          replace: true,
        });
      }}
    />
  );
}
