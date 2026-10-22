import type { Catalogo } from "@/shared/services/catalogo.service";
import { nomeCondicaoCar, nomeLugar, termoArranjo, termoNivel } from "@/shared/utils/glossario";

import { DIMENSOES_FILTRO, NENHUM_TIPO, type DimensaoFiltro, type FiltrosAreas } from "./filtros";

/** Os filtros em texto, para o CSV ("tipo de área: Reserva Legal (RL); tema: …"); sem filtro, "". */
export function descreverFiltros(filtros: FiltrosAreas, catalogo: Catalogo): string {
  const titulo = (lista: ReadonlyArray<{ codigo: string; titulo: string }>, codigo: string) =>
    lista.find((item) => item.codigo === codigo)?.titulo ?? codigo;
  const niveis = catalogo.niveis.map((n) => ({ codigo: n.nivel, titulo: n.titulo }));
  const arranjos = catalogo.arranjos.map((a) => ({ codigo: a.arranjo, titulo: a.titulo }));
  const temas = catalogo.filtros.map((f) => ({ codigo: f.filtro, titulo: f.titulo }));
  const nomes: Record<DimensaoFiltro, { rotulo: string; nome: (valor: string) => string }> = {
    categorias: {
      rotulo: "tipo de área",
      nome: (v) => (v === NENHUM_TIPO ? "nenhum" : termoNivel(v, titulo(niveis, v)).nome),
    },
    situacoes: { rotulo: "situação do cadastro", nome: nomeCondicaoCar },
    caminhos: { rotulo: "arranjo", nome: (v) => termoArranjo(v, titulo(arranjos, v)).nome },
    estados: { rotulo: "estado", nome: (v) => nomeLugar("uf", v, v) },
    biomas: { rotulo: "bioma", nome: (v) => nomeLugar("bioma", v, v) },
    temas: { rotulo: "tema", nome: (v) => titulo(temas, v) },
  };
  const partes: string[] = [];
  for (const dimensao of DIMENSOES_FILTRO) {
    if (filtros[dimensao].length === 0) continue;
    const { rotulo, nome } = nomes[dimensao];
    partes.push(`${rotulo}: ${filtros[dimensao].map(nome).join(", ")}`);
  }
  return partes.join("; ");
}
