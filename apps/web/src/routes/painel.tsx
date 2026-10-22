import { createFileRoute } from "@tanstack/react-router";

import { PainelScreen, parametrosDoPainel } from "@/modules/painel";

export const Route = createFileRoute("/painel")({
  validateSearch: parametrosDoPainel,
  component: Rota,
});

function Rota() {
  const { geoserver } = Route.useRouteContext();
  const estado = Route.useSearch();
  const navegar = Route.useNavigate();
  return (
    <PainelScreen
      estado={estado}
      geoserver={geoserver}
      onEstadoChange={(alteracao) => {
        void navegar({
          // Só os parâmetros que o painel conhece voltam à URL; os que voltaram ao padrão
          // (`undefined`) saem dela.
          search: (atual) => ({ ...parametrosDoPainel.parse(atual), ...alteracao }),
          replace: true,
        });
      }}
    />
  );
}
