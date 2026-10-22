import { type ReactNode, useState } from "react";

import { LoadingState } from "@sinaveg/ui";

import { BarrasHorizontais } from "@/shared/components/graficos/BarrasHorizontais";
import { FiguraGrafico } from "@/shared/components/graficos/FiguraGrafico";
import type { ItemBarra } from "@/shared/components/graficos/tipos";
import {
  formatarHectaresResumido,
  formatarInteiro,
  formatarParticipacao,
} from "@/shared/utils/formatos";
import {
  type NomeDimensao,
  nomeLugar,
  osPlural,
  palavrasDoGenero,
  todosOsPlural,
} from "@/shared/utils/glossario";
import { maiuscula } from "@/shared/utils/textos";

import type { ValorRanking } from "../../services/lugar.service";
import type { Indicador } from "../../types";
import { textoDosPoligonos } from "../../utils/assuntos";
import { RANKING_MAXIMO } from "../../utils/constantes";
import type { Csv } from "../../utils/csv";
import { CartaoDoPainel } from "./CartaoDoPainel";
import { TabelaParticipacao } from "./TabelaParticipacao";

/** Os lugares de um recorte com mais área; escolher um abre os números dele. */
export function SecaoRanking({
  id,
  dimensao,
  nomes,
  valores,
  inicial,
  csv,
  explicacao,
  nota,
  controle,
  onSelecionar,
  onVerTodos,
}: {
  id: string;
  dimensao: string;
  nomes: NomeDimensao;
  valores: readonly ValorRanking[] | undefined;
  /** Quantos mostrar antes de "mostrar todos"; sem ele, até `RANKING_MAXIMO`. */
  inicial?: number;
  /** Sem ele (a lista ainda não chegou), o cartão fica sem link. */
  csv?: Csv | undefined;
  /** No lugar da explicação padrão (como escolher um lugar). */
  explicacao?: string | undefined;
  /** Uma frase sob o gráfico (a lista que não segue os filtros, por exemplo). */
  nota?: string | undefined;
  /** Acima do gráfico: a troca de nível das bacias, por exemplo. */
  controle?: ReactNode;
  /** Sem ele, as barras só mostram a área, sem abrir o lugar. */
  onSelecionar?: ((chave: string) => void) | undefined;
  /**
   * Com ele, "ver todos" leva à lista do recorte (com a busca) em vez de abrir a lista aqui: as
   * bacias são centenas.
   */
  onVerTodos?: (() => void) | undefined;
}) {
  const [todos, setTodos] = useState(false);
  const comChave = (valores ?? []).filter((v) => v.chave !== null);
  // Quantos lugares a lista tem: os municípios são 5 mil, e só os mostrados viram barra.
  const quantos = comChave.length;
  const total = (valores ?? []).reduce((soma, v) => soma + v.area_ha, 0);
  const limite = limiteDaLista(inicial, todos, quantos);
  const itens: ItemBarra[] = comChave.slice(0, limite).map((v) => ({
    chave: v.chave ?? "",
    rotulo: nomeLugar(dimensao, v.chave, v.rotulo),
    valor: v.area_ha,
    detalhe: textoDosPoligonos(v.n_poligonos),
  }));
  // Os textos com artigo seguem o gênero da dimensão: "as bacias", "numa bacia", "dela".
  const palavras = palavrasDoGenero(nomes);
  const titulo = `${maiuscula(nomes.plural)} com mais área`;
  const explicacaoPadrao =
    inicial === undefined
      ? `Escolha ${nomes.artigo} ${nomes.singular} na lista ou pelo nome, no campo acima.`
      : `Clique ${palavras.num} ${nomes.singular} para ver os números ${palavras.dele}.`;
  return (
    <CartaoDoPainel
      csv={csv}
      explicacao={explicacao ?? explicacaoPadrao}
      id={id}
      indicador={indicadorDoPrimeiro(itens[0], total)}
      largura="inteira"
      tabela={
        <TabelaParticipacao
          linhas={itens.map((i) => ({ chave: i.chave, nome: i.rotulo, valor: i.valor }))}
          nome={maiuscula(nomes.singular)}
          total={total}
        />
      }
      titulo={titulo}
    >
      {controle === undefined ? null : <div className="mb-5">{controle}</div>}
      {valores === undefined ? (
        <LoadingState>Carregando {osPlural(nomes)}…</LoadingState>
      ) : (
        <FiguraGrafico mostrarTitulo={false} titulo={titulo}>
          <BarrasHorizontais itens={itens} onSelecionar={onSelecionar} total={total} />
          {inicial !== undefined && quantos > inicial ? (
            <BotaoVerTodos
              inicial={inicial}
              nomes={nomes}
              onAlternar={() => setTodos(!todos)}
              onVerTodos={onVerTodos}
              todos={todos}
            />
          ) : null}
          {inicial === undefined && quantos > RANKING_MAXIMO ? (
            <p className="mt-5 text-sm text-muted-foreground">
              Mostrando {palavras.os} {RANKING_MAXIMO} {nomes.plural} com mais área, de{" "}
              {formatarInteiro(quantos)}. Use a busca para encontrar {palavras.os} {palavras.outros}
              .
            </p>
          ) : null}
          {nota === undefined ? null : <p className="mt-5 text-sm text-muted-foreground">{nota}</p>}
        </FiguraGrafico>
      )}
    </CartaoDoPainel>
  );
}

/**
 * Quantos lugares viram barra: sem `inicial`, até `RANKING_MAXIMO`; com ele (uma lista curta,
 * como a dos estados), os primeiros ou, depois de "mostrar todos", todos mesmo.
 */
function limiteDaLista(inicial: number | undefined, todos: boolean, quantos: number): number {
  if (inicial === undefined) return RANKING_MAXIMO;
  return todos ? quantos : inicial;
}

/** O número do cartão: o primeiro da lista e a parte dele no total. */
function indicadorDoPrimeiro(
  primeiro: ItemBarra | undefined,
  total: number,
): Indicador | undefined {
  if (primeiro === undefined || total <= 0) return undefined;
  return {
    valor: primeiro.rotulo,
    rotulo: `${formatarHectaresResumido(primeiro.valor)}, ${formatarParticipacao(primeiro.valor / total)} do total`,
  };
}

/**
 * O botão sob uma lista curta: abre e fecha a lista inteira aqui ou, com `onVerTodos`, leva à
 * lista do recorte.
 */
function BotaoVerTodos({
  nomes,
  inicial,
  todos,
  onAlternar,
  onVerTodos,
}: {
  nomes: NomeDimensao;
  inicial: number;
  todos: boolean;
  onAlternar: () => void;
  onVerTodos: (() => void) | undefined;
}) {
  const classe = "mt-5 text-[15px] font-medium text-primary hover:underline";
  if (onVerTodos !== undefined) {
    return (
      <button className={classe} onClick={onVerTodos} type="button">
        Ver {todosOsPlural(nomes)}
      </button>
    );
  }
  const { os, primeiros } = palavrasDoGenero(nomes);
  return (
    <button aria-expanded={todos} className={classe} onClick={onAlternar} type="button">
      {todos ? `Mostrar só ${os} ${inicial} ${primeiros}` : `Mostrar ${todosOsPlural(nomes)}`}
    </button>
  );
}
