import { BarChart3, BookOpenText, Map as MapIcon } from "lucide-react";

import { Caminho } from "./Caminho";

/**
 * "O que você quer ver?": os três caminhos do portal, com os mesmos nomes do topo da página
 * (revisão da MMA de 16/10/2026).
 */
export function CaminhosDoPortal() {
  return (
    <section aria-labelledby="caminhos-titulo">
      <h2 className="text-2xl font-semibold tracking-tight" id="caminhos-titulo">
        O que você quer ver?
      </h2>
      <ul className="mt-5 grid gap-4 md:grid-cols-3">
        <Caminho icone={MapIcon} titulo="Mapa" to="/mapa" />
        <Caminho icone={BarChart3} titulo="Painel" to="/painel" />
        <Caminho icone={BookOpenText} titulo="Acesso aos dados" to="/dados" />
      </ul>
    </section>
  );
}
