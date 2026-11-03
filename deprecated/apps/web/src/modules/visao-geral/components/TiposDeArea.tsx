import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";

import type { CatalogoNivel } from "@sinaveg/web-contracts";

import { FiguraGrafico } from "@/shared/components/graficos/FiguraGrafico";
import { Rosca } from "@/shared/components/graficos/Rosca";
import { fatiasDosCriterios, respostaMaiorParte } from "@/shared/utils/criterios";

/**
 * "Em que tipo de área está essa vegetação?": a rosca das duas categorias do relatório da
 * metodologia (projetos de recuperação e vegetação secundária em áreas legalmente protegidas),
 * só com o percentual de cada uma, e o link ao painel.
 */
export function TiposDeArea({
  catalogoNiveis,
  porNivel,
}: {
  catalogoNiveis: readonly CatalogoNivel[];
  porNivel: ReadonlyMap<string, number>;
}) {
  const fatias = fatiasDosCriterios(catalogoNiveis, porNivel);
  const resposta = respostaMaiorParte(fatias);
  return (
    <section
      aria-labelledby="tipos-titulo"
      className="rounded-2xl border bg-card px-5 py-7 shadow-xs sm:px-10 sm:py-9"
    >
      <h2 className="text-2xl font-semibold tracking-tight text-balance" id="tipos-titulo">
        Em que tipo de área está essa vegetação?
      </h2>
      {resposta === undefined ? null : (
        <p className="mt-3 max-w-3xl text-lg leading-snug">{resposta}</p>
      )}
      <div className="mt-8">
        <FiguraGrafico mostrarTitulo={false} titulo="Área por categoria">
          <Rosca fatias={fatias} rotuloTotal="no total" soPercentual />
        </FiguraGrafico>
      </div>
      <Link
        className="mt-8 inline-flex items-center gap-1.5 text-[15px] font-medium text-primary hover:underline"
        hash="tipos"
        to="/painel"
      >
        Ver mais números no painel
        <ArrowRight aria-hidden className="size-4" />
      </Link>
    </section>
  );
}
