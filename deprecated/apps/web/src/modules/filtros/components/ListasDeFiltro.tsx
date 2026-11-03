import type { TotaisDasListas, Total } from "../utils/facetas";
import type { DimensaoFiltro, FiltrosAreas } from "../utils/filtros";
import type { Lista } from "../utils/opcoes";
import { Faceta } from "./Faceta";

/** Os totais de uma lista que ainda não chegaram. */
const NENHUM: ReadonlyMap<string, Total> = new Map();

/**
 * Os filtros das áreas, iguais no mapa e no painel: uma seção da lateral por lista (os temas
 * também), com a área que sobra em cada valor se ele for escolhido, considerando os filtros das
 * outras listas.
 */
export function ListasDeFiltro({
  filtros,
  totais,
  listas,
  notaTipos,
  onAlternar,
  tiposAbertos = true,
  tiposTodosPorPadrao = true,
}: {
  filtros: FiltrosAreas;
  /**
   * A área ao lado de cada opção, lista por lista (`totaisDasListas`, somada por quem chama);
   * `undefined` enquanto as facetas carregam.
   */
  totais: TotaisDasListas | undefined;
  listas: readonly Lista[];
  notaTipos: string;
  onAlternar: (dimensao: DimensaoFiltro, valor: string) => void;
  tiposAbertos?: boolean;
  /** Sem tipo escolhido, todos aparecem marcados (no painel); no mapa, nenhum. */
  tiposTodosPorPadrao?: boolean;
}) {
  const carregando = totais === undefined;
  return (
    <fieldset className="m-0 min-w-0 border-0 p-0">
      <legend className="sr-only">Filtrar áreas</legend>
      {listas.map((lista) => {
        const tipos = lista.dimensao === "categorias";
        return (
          <Faceta
            aberta={tipos && tiposAbertos}
            carregando={carregando}
            escolhidos={filtros[lista.dimensao]}
            key={lista.dimensao}
            nota={tipos ? notaTipos : lista.nota}
            onAlternar={(valor) => onAlternar(lista.dimensao, valor)}
            opcoes={lista.opcoes}
            titulo={lista.titulo}
            todosPorPadrao={tipos && tiposTodosPorPadrao}
            totais={totais?.[lista.dimensao] ?? NENHUM}
          />
        );
      })}
    </fieldset>
  );
}
