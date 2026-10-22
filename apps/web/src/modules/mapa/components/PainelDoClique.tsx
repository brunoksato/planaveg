import type { Catalogo } from "@/shared/services/catalogo.service";

import type { CliqueNoMapa } from "../hooks/useCliqueNoMapa";
import { PainelIdentificacao } from "./PainelIdentificacao";

/** O canto de baixo do mapa: o que o clique achou ou, sem nada aberto, a dica do que clicar. */
export function PainelDoClique({ catalogo, clique }: { catalogo: Catalogo; clique: CliqueNoMapa }) {
  const { identificacao } = clique;
  if (identificacao !== undefined) {
    return (
      <PainelIdentificacao
        catalogo={catalogo}
        identificacao={identificacao}
        onFechar={clique.fecharIdentificacao}
      />
    );
  }
  return (
    <p className="pointer-events-none absolute right-3 bottom-8 z-[1000] hidden rounded-full bg-card/95 px-3.5 py-1.5 text-sm text-muted-foreground shadow sm:block">
      Clique numa área colorida para ver o que ela é
    </p>
  );
}
