import type { Catalogo } from "@/shared/services/catalogo.service";
import { nomeLugar } from "@/shared/utils/glossario";

import type { TotaisDasListas } from "../utils/facetas";
import type { DimensaoFiltro, FiltrosAreas } from "../utils/filtros";
import { listasDeAtributo, ordenarPorNome, type Lista } from "../utils/opcoes";
import { ListasDeFiltro } from "./ListasDeFiltro";

/**
 * Os filtros das áreas no mapa: uma seção da lateral por lista. Os tipos de área vêm primeiro e
 * abertos: são as cores do mapa e as camadas da legenda. Nenhum vem marcado: a pessoa escolhe o
 * que ver (revisão da MMA de 16/10/2026).
 */
export function FiltrosDoMapa({
  catalogo,
  totais,
  lugares,
  filtros,
  onAlternar,
}: {
  catalogo: Catalogo;
  /**
   * A área de cada opção de cada lista, somada das facetas do ano (`quantitativo_faceta`);
   * `undefined` enquanto elas carregam.
   */
  totais: TotaisDasListas | undefined;
  /** Todos os estados e biomas do ano, mesmo os que os filtros zeram: a lista não muda. */
  lugares: { estados: readonly string[]; biomas: readonly string[] };
  filtros: FiltrosAreas;
  onAlternar: (dimensao: DimensaoFiltro, valor: string) => void;
}) {
  const listas: Lista[] = [
    ...listasDeAtributo(catalogo),
    {
      dimensao: "estados",
      titulo: "Estado",
      opcoes: ordenarPorNome(
        lugares.estados.map((uf) => ({ valor: uf, nome: nomeLugar("uf", uf, uf) })),
      ),
    },
    {
      dimensao: "biomas",
      titulo: "Bioma",
      opcoes: ordenarPorNome(
        lugares.biomas.map((b) => ({ valor: b, nome: nomeLugar("bioma", b, b) })),
      ),
    },
  ];
  return (
    <ListasDeFiltro
      filtros={filtros}
      listas={listas}
      notaTipos="Marque os tipos que quer ver: cada tipo marcado é uma camada da legenda sobre o mapa."
      onAlternar={onAlternar}
      tiposTodosPorPadrao={false}
      totais={totais}
    />
  );
}
