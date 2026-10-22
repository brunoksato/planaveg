import type { Total } from "@/modules/filtros";
import { FiguraGrafico } from "@/shared/components/graficos/FiguraGrafico";
import { Rosca } from "@/shared/components/graficos/Rosca";
import { formatarParticipacao } from "@/shared/utils/formatos";
import { nomeLugar } from "@/shared/utils/glossario";

import type { ContextoCsv } from "../../types";
import { participacao, textoDosPoligonos } from "../../utils/assuntos";
import { BIOMAS, COR_OUTRO_BIOMA } from "../../utils/constantes";
import { csvDoPainel } from "../../utils/csv";
import { CartaoDoPainel } from "./CartaoDoPainel";
import { TabelaParticipacao } from "./TabelaParticipacao";

/** A posição do bioma na rosca: a da lista; os outros (fora dos limites) no fim. */
function ordem(bioma: string): number {
  const indice = BIOMAS.findIndex((b) => b.chave === bioma);
  return indice === -1 ? BIOMAS.length : indice;
}

/**
 * Em que bioma está a área, numa rosca: só aparece quando ela está em mais de um. Cada bioma tem
 * a sua cor e o seu lugar na rosca em qualquer lugar do painel.
 */
export function SecaoBiomas({
  biomas,
  total,
  contexto,
}: {
  biomas: ReadonlyArray<readonly [string, Total]>;
  total: number;
  contexto: ContextoCsv;
}) {
  const fatias = biomas
    .toSorted((a, b) => ordem(a[0]) - ordem(b[0]))
    .map(([bioma, t]) => ({
      chave: bioma,
      rotulo: nomeLugar("bioma", bioma, bioma),
      valor: t.area,
      cor: BIOMAS.find((b) => b.chave === bioma)?.cor ?? COR_OUTRO_BIOMA,
      detalhe: textoDosPoligonos(t.poligonos),
      poligonos: t.poligonos,
    }));
  // O de mais área vem primeiro na lista recebida.
  const maior = biomas[0];
  return (
    <CartaoDoPainel
      csv={csvDoPainel(
        contexto,
        "biomas",
        "Baixar os dados por bioma (CSV)",
        ["bioma", "area_ha", "poligonos", "do_total"],
        fatias.map((f) => [f.rotulo, f.valor, f.poligonos, participacao(f.valor, total)]),
      )}
      explicacao="Os biomas são as grandes regiões de vegetação do país, segundo o IBGE."
      id="biomas"
      indicador={
        maior === undefined || total <= 0
          ? undefined
          : {
              valor: nomeLugar("bioma", maior[0], maior[0]),
              rotulo: `${formatarParticipacao(maior[1].area / total)} da área`,
            }
      }
      largura="inteira"
      tabela={
        <TabelaParticipacao
          linhas={fatias.map((f) => ({ chave: f.chave, nome: f.rotulo, valor: f.valor }))}
          nome="Bioma"
          total={total}
        />
      }
      titulo="Biomas"
    >
      <FiguraGrafico mostrarTitulo={false} titulo="Área por bioma">
        <Rosca fatias={fatias} rotuloTotal="no total" />
      </FiguraGrafico>
    </CartaoDoPainel>
  );
}
