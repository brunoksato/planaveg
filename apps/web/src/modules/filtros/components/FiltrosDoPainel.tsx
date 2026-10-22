import { useMemo } from "react";

import type { Catalogo } from "@/shared/services/catalogo.service";

import { type LinhaFaceta, totaisDasListas } from "../utils/facetas";
import { DIMENSOES_DO_PAINEL, type DimensaoFiltro, type FiltrosAreas } from "../utils/filtros";
import { listasDeAtributo } from "../utils/opcoes";
import { ListasDeFiltro } from "./ListasDeFiltro";

/**
 * Os filtros do painel, na lateral como os do mapa: as listas, menos estado
 * e bioma (o lugar se escolhe acima). Com filtro, todos os números da página respondem só pelas
 * áreas escolhidas.
 */
export function FiltrosDoPainel({
  catalogo,
  linhas,
  filtros,
  onAlternar,
  tiposAbertos = true,
}: {
  catalogo: Catalogo;
  /** As facetas do lugar no ano; `undefined` enquanto carregam. */
  linhas: readonly LinhaFaceta[] | undefined;
  filtros: FiltrosAreas;
  onAlternar: (dimensao: DimensaoFiltro, valor: string) => void;
  /** A lista de tipos de área começa aberta (no celular, fechada). */
  tiposAbertos?: boolean;
}) {
  const totais = useMemo(
    () =>
      linhas === undefined ? undefined : totaisDasListas(linhas, filtros, DIMENSOES_DO_PAINEL),
    [linhas, filtros],
  );
  return (
    <ListasDeFiltro
      filtros={filtros}
      listas={listasDeAtributo(catalogo)}
      notaTipos="Todos marcados é o padrão. Desmarque para tirar um tipo dos números."
      onAlternar={onAlternar}
      tiposAbertos={tiposAbertos}
      totais={totais}
    />
  );
}
