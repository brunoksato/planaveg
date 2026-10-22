import { MAIS_DE_UMA, type Resumo, SEM_ESFERA, type Total } from "@/modules/filtros";
import { FiguraGrafico } from "@/shared/components/graficos/FiguraGrafico";
import { Rosca } from "@/shared/components/graficos/Rosca";
import { formatarHectaresResumido } from "@/shared/utils/formatos";
import { nomeEsferaUc, nomeTipoUc } from "@/shared/utils/glossario";

import type { ContextoCsv } from "../../types";
import { participacao, textoDosPoligonos } from "../../utils/assuntos";
import { ESFERAS_UC, TIPOS_UC } from "../../utils/constantes";
import { csvDoPainel } from "../../utils/csv";
import { CartaoDoPainel } from "./CartaoDoPainel";
import { TabelaParticipacao } from "./TabelaParticipacao";

/** As fatias de uma divisão das UCs, na ordem e nas cores dela, só as que têm área. */
function fatiasDe(
  divisao: ReadonlyArray<{ chave: string; cor: string }>,
  porValor: ReadonlyMap<string, Total>,
  nome: (chave: string) => string,
) {
  return divisao.flatMap(({ chave, cor }) => {
    const total = porValor.get(chave);
    return total === undefined || total.area <= 0
      ? []
      : [
          {
            chave,
            rotulo: nome(chave),
            valor: total.area,
            cor,
            poligonos: total.poligonos,
            detalhe: textoDosPoligonos(total.poligonos),
          },
        ];
  });
}

/**
 * As áreas dentro de Unidades de Conservação, pela esfera e pelo tipo da UC (o Anexo 2 pede
 * esfera e categoria), numa rosca para cada divisão. Cada área entra numa parte só de cada
 * rosca: a que está em UCs de esferas ou tipos diferentes tem a parte dela.
 */
export function SecaoUcs({ atual, contexto }: { atual: Resumo; contexto: ContextoCsv }) {
  const total = atual.ucs.area;
  const esferas = fatiasDe(ESFERAS_UC, atual.porEsferaUc, nomeEsferaUc);
  const tipos = fatiasDe(TIPOS_UC, atual.porTipoUc, nomeTipoUc);
  const maiorEsfera = esferas
    .filter((e) => e.chave !== MAIS_DE_UMA && e.chave !== SEM_ESFERA)
    .toSorted((a, b) => b.valor - a.valor)[0];
  const divisoes = [
    { grupo: "esfera", titulo: "Por esfera", fatias: esferas },
    { grupo: "tipo", titulo: "Por tipo", fatias: tipos },
  ];
  return (
    <CartaoDoPainel
      csv={csvDoPainel(
        contexto,
        "unidades-de-conservacao",
        "Baixar os dados por esfera e tipo de UC (CSV)",
        ["grupo", "codigo", "nome", "area_ha", "poligonos", "do_total"],
        divisoes.flatMap((d) =>
          d.fatias.map((f) => [
            d.grupo,
            f.chave,
            f.rotulo,
            f.valor,
            f.poligonos,
            participacao(f.valor, total),
          ]),
        ),
      )}
      explicacao="Conta toda área dentro de uma UC, qualquer que seja o tipo de área dela. A área que fica em UCs de esferas ou de tipos diferentes, sobrepostas, entra numa parte à parte. Nas APAs, o relatório só conta como Unidade de Conservação as áreas públicas; as privadas seguem as regras dos imóveis rurais."
      id="ucs"
      indicador={{
        valor: formatarHectaresResumido(total),
        rotulo:
          maiorEsfera === undefined
            ? "dentro de Unidades de Conservação"
            : `dentro de UCs; mais em UCs ${maiorEsfera.rotulo.toLocaleLowerCase("pt-BR")}`,
      }}
      largura="inteira"
      tabela={
        <div className="space-y-6">
          {divisoes.map((d) => (
            <TabelaParticipacao
              key={d.grupo}
              linhas={d.fatias.map((f) => ({ chave: f.chave, nome: f.rotulo, valor: f.valor }))}
              nome={`Unidades de Conservação ${d.titulo.toLocaleLowerCase("pt-BR")}`}
              total={total}
            />
          ))}
        </div>
      }
      titulo="Unidades de Conservação por esfera e tipo"
    >
      <div className="grid gap-x-10 gap-y-10 lg:grid-cols-2">
        {divisoes.map((d) => (
          <div key={d.grupo}>
            <h3 className="mb-4 text-sm font-semibold text-muted-foreground">{d.titulo}</h3>
            <FiguraGrafico
              mostrarTitulo={false}
              titulo={`Áreas em Unidades de Conservação ${d.titulo.toLocaleLowerCase("pt-BR")}`}
            >
              <Rosca fatias={d.fatias} rotuloTotal="em UCs" />
            </FiguraGrafico>
          </div>
        ))}
      </div>
    </CartaoDoPainel>
  );
}
