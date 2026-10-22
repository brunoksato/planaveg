import { formatarContagemResumida, formatarHectaresResumido } from "@/shared/utils/formatos";

import type { Total } from "../utils/facetas";
import { NENHUM_TIPO, temFiltros, type FiltrosAreas } from "../utils/filtros";

/**
 * O que está no mapa, sempre em duas linhas, para a lateral não pular ao filtrar: "Todas as
 * áreas:" ou "Mostrando" em cima e "8,8 milhões de ha em 4,8 milhões de polígonos." embaixo. Sem
 * nenhum tipo de área marcado (o padrão do mapa), diz como escolher.
 * Conta polígonos, não peças: cada peça da base junta os polígonos de mesmos atributos no
 * município e na bacia, e quem olha o mapa vê os polígonos.
 */
export function ResumoDasAreas({
  total,
  filtros,
  filtrando = temFiltros(filtros),
  falhou = false,
}: {
  /** As áreas que atendem os filtros, somadas das facetas; `undefined` enquanto elas carregam. */
  total: Total | undefined;
  filtros: FiltrosAreas;
  /** Vê só parte das áreas; no mapa, todos os tipos marcados não filtram nada. */
  filtrando?: boolean;
  /** A soma não veio: diz isso em vez de "Somando as áreas…" para sempre. */
  falhou?: boolean;
}) {
  if (filtros.categorias.includes(NENHUM_TIPO)) {
    return (
      <p aria-live="polite" className="min-w-0 text-[13px] leading-5 text-muted-foreground">
        <span className="block">Nenhum tipo de área marcado.</span>
        <span className="block">Marque na lista os tipos que quer ver no mapa.</span>
      </p>
    );
  }
  return (
    <p aria-live="polite" className="min-w-0 text-[13px] leading-5 text-muted-foreground">
      <span className="block truncate">{filtrando ? "Mostrando " : "Todas as áreas: "}</span>
      {total === undefined ? (
        <span className="block">
          {falhou ? "Não foi possível somar as áreas." : "Somando as áreas…"}
        </span>
      ) : (
        <span className="block">
          <strong className="font-semibold text-foreground">
            {formatarHectaresResumido(total.area)}
          </strong>{" "}
          em {formatarContagemResumida(total.poligonos, "polígono", "polígonos")}.
        </span>
      )}
    </p>
  );
}
