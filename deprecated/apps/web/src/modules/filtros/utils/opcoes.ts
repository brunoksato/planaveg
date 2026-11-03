import type { Catalogo } from "@/shared/services/catalogo.service";
import {
  CONDICOES_DO_CADASTRO,
  criterioDoGrupo,
  foraDosLimites,
  termoArranjo,
  termoCondicaoCar,
  termoCriterio,
  termoNivel,
} from "@/shared/utils/glossario";
import { separarArranjos } from "@/shared/utils/metas";
import { nivelUnicos } from "@/shared/utils/niveis";

import type { DimensaoFiltro } from "./filtros";

/** Uma opção de uma lista de filtro: o valor, o nome e, se houver, o grupo, a cor e uma nota. */
export type Opcao = {
  valor: string;
  nome: string;
  grupo?: string | undefined;
  cor?: string | undefined;
  /** Uma frase sob o nome, que explica o número dele. */
  nota?: string | undefined;
};

/** Uma lista de filtro: a dimensão, o título, uma nota e as opções. */
export type Lista = {
  dimensao: DimensaoFiltro;
  titulo: string;
  nota?: string;
  opcoes: Opcao[];
};

/**
 * Os arranjos oferecidos na lista: os três do plano. As demais áreas de projetos não são um
 * arranjo e ficam fora da lista (e da URL).
 */
export function arranjosFiltraveis(arranjos: Catalogo["arranjos"]): Catalogo["arranjos"] {
  return separarArranjos(arranjos).doPlano;
}

/**
 * Os filtros do relatório oferecidos como tema: os que o contrato marca como tema
 * (`catalogo_filtro.tema`: espaciais e sem repetir um arranjo, que já é uma lista). O aquecimento
 * do core semeia os mesmos.
 */
export function temasFiltraveis(filtros: Catalogo["filtros"]): Catalogo["filtros"] {
  return filtros.filter((f) => f.tema);
}

/**
 * Os tipos de área que a base traz, na ordem da hierarquia (dos projetos à Reserva Legal), no
 * critério de cada um (intencionalidade ou governança): a ordem da lista e a da legenda do mapa,
 * de cima para baixo.
 */
export function tiposDeArea(catalogo: Catalogo): Opcao[] {
  const niveis = nivelUnicos(catalogo.niveis).filter((n) => n.presente);
  return niveis.map((n) => ({
    valor: n.nivel,
    nome: termoNivel(n.nivel, n.titulo).nome,
    grupo: termoCriterio(criterioDoGrupo(n.grupo)).nome,
    cor: n.cor,
  }));
}

/** As listas de tipo de área, situação do cadastro, arranjo e tema, nas duas telas. */
export function listasDeAtributo(catalogo: Catalogo): Lista[] {
  return [
    { dimensao: "categorias", titulo: "Tipo de área", opcoes: tiposDeArea(catalogo) },
    {
      dimensao: "situacoes",
      titulo: "Situação do cadastro",
      nota: "Só as APP, AUR e Reserva Legal de imóveis do CAR têm situação do cadastro.",
      opcoes: CONDICOES_DO_CADASTRO.map((c) => ({ valor: c, nome: termoCondicaoCar(c).nome })),
    },
    {
      dimensao: "caminhos",
      titulo: "Arranjo de implementação",
      opcoes: arranjosFiltraveis(catalogo.arranjos).map((a) => ({
        valor: a.arranjo,
        nome: termoArranjo(a.arranjo, a.titulo).nome,
        cor: a.cor,
      })),
    },
    {
      dimensao: "temas",
      titulo: "Temas do relatório",
      nota: "Uma área pode estar em vários temas.",
      // O nome do relatório. A nota de um tema completo explica o número dele (o manguezal do
      // tema é maior que o da categoria); as dos parciais dizem o que falta no arquivo e ficam
      // nos Metadados.
      opcoes: temasFiltraveis(catalogo.filtros).map((f) => ({
        valor: f.filtro,
        nome: f.titulo,
        nota: f.status === "presente" ? (f.nota ?? undefined) : undefined,
      })),
    },
  ];
}

/** Em ordem de nome; "fora dos limites" por último. */
export function ordenarPorNome(opcoes: Opcao[]): Opcao[] {
  return opcoes.toSorted((a, b) => {
    const foraA = foraDosLimites(a.valor) ? 1 : 0;
    const foraB = foraDosLimites(b.valor) ? 1 : 0;
    return foraA - foraB || a.nome.localeCompare(b.nome, "pt-BR");
  });
}
