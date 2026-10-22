import { DIMENSOES_DO_PAINEL, type FiltrosAreas, filtrosParaUrl } from "@/modules/filtros";
import type { EstadoPainel } from "@/modules/painel";

/**
 * O painel do que o mapa mostra: o município escolhido, ou o único estado ou bioma filtrado,
 * com os outros filtros (o painel mostra um lugar por vez; com mais de um, o Brasil inteiro).
 * `filtros` são os das áreas, com os tipos como o painel os lê: nenhum tipo marcado (o padrão do
 * mapa) ou todos viram todos no painel.
 */
export function buscaDoPainel(municipio: string | undefined, filtros: FiltrosAreas): EstadoPainel {
  return { ...lugarDoPainel(municipio, filtros), ...filtrosParaUrl(filtros, DIMENSOES_DO_PAINEL) };
}

/** O município; sem ele, o único estado ou o único bioma filtrado; fora isso, o Brasil inteiro. */
function lugarDoPainel(
  municipio: string | undefined,
  filtros: FiltrosAreas,
): { dimensao?: string; chave?: string } {
  if (municipio !== undefined) return { dimensao: "municipio", chave: municipio };
  const [estado, outroEstado] = filtros.estados;
  const [bioma, outroBioma] = filtros.biomas;
  if (estado !== undefined && outroEstado === undefined && bioma === undefined) {
    return { dimensao: "uf", chave: estado };
  }
  if (bioma !== undefined && outroBioma === undefined && estado === undefined) {
    return { dimensao: "bioma", chave: bioma };
  }
  return {};
}
