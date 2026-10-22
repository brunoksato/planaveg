import type { CatalogoNivel } from "@sinaveg/web-contracts";

import type { Resumo } from "@/modules/filtros";
import { BarrasHorizontais } from "@/shared/components/graficos/BarrasHorizontais";
import { FiguraGrafico } from "@/shared/components/graficos/FiguraGrafico";
import { Rosca } from "@/shared/components/graficos/Rosca";
import { fatiasDosCriterios } from "@/shared/utils/criterios";
import { criterioDoGrupo, nomeOficial, termoCriterio, termoNivel } from "@/shared/utils/glossario";
import { nivelUnicos } from "@/shared/utils/niveis";
import { somar } from "@/shared/utils/numeros";

import type { ContextoCsv } from "../../types";
import { participacao } from "../../utils/assuntos";
import { csvDoPainel } from "../../utils/csv";
import { CartaoDoPainel } from "./CartaoDoPainel";
import { SemArea } from "./SemArea";
import { TabelaParticipacao } from "./TabelaParticipacao";

/**
 * Os tipos de área: a rosca dos dois grupos do cômputo (projetos de recuperação e vegetação
 * secundária em áreas legalmente protegidas) e as barras de cada categoria, com os nomes da
 * planilha de nomenclatura.
 */
export function SecaoTipos({
  niveis,
  atual,
  contexto,
}: {
  niveis: readonly CatalogoNivel[];
  atual: Resumo;
  contexto: ContextoCsv;
}) {
  const todos = nivelUnicos(niveis);
  const fatias = fatiasDosCriterios(niveis, atual.porNivel);
  const categorias = todos.flatMap((n) => {
    const valor = atual.porNivel.get(n.nivel) ?? 0;
    if (!n.presente || valor <= 0) return [];
    const termo = termoNivel(n.nivel, n.titulo);
    const criterio = termoCriterio(criterioDoGrupo(n.grupo));
    return [
      {
        chave: n.nivel,
        rotulo: termo.nome,
        valor,
        cor: n.cor,
        criterio: criterio.nome,
        // O nome do grupo já diz o que ele é: "Vegetação secundária em áreas legalmente…".
        grupo: criterio.nome,
        detalhe: nomeOficial(termo, n.titulo),
      },
    ];
  });
  const ausentes = todos.filter((n) => !n.presente);
  const vazio = somar(fatias) <= 0;
  const total = atual.total.area;
  return (
    <CartaoDoPainel
      csv={csvDoPainel(
        contexto,
        "tipos-de-area",
        "Baixar os dados por tipo de área (CSV)",
        ["codigo", "nome", "criterio", "area_ha", "do_total"],
        categorias.map((c) => [
          c.chave,
          c.rotulo,
          c.criterio,
          c.valor,
          participacao(c.valor, total),
        ]),
      )}
      explicacao="Cada área entra em uma categoria só, na ordem de prioridade do Planaveg; somadas, dão o total."
      id="tipos"
      largura="inteira"
      tabela={
        vazio ? undefined : (
          <TabelaParticipacao
            colunaGrupo="Critério"
            linhas={categorias.map((c) => ({
              chave: c.chave,
              nome: c.rotulo,
              oficial: c.detalhe,
              grupo: c.criterio,
              valor: c.valor,
            }))}
            nome="Categoria"
            total={total}
          />
        )
      }
      titulo="Tipos de área"
    >
      {vazio ? (
        <SemArea />
      ) : (
        <>
          <FiguraGrafico mostrarTitulo={false} titulo="Área por critério">
            <Rosca fatias={fatias} rotuloTotal="no total" />
          </FiguraGrafico>
          <div className="mt-12">
            <FiguraGrafico
              descricao="Para ver o número exato, passe o mouse numa barra ou abra a tabela abaixo."
              titulo="Área por categoria"
            >
              <BarrasHorizontais itens={categorias} total={total} />
            </FiguraGrafico>
            {ausentes.length === 0 ? null : (
              <p className="mt-5 text-sm text-muted-foreground">
                Sem dados nesta base:{" "}
                {ausentes.map((n) => termoNivel(n.nivel, n.titulo).nome).join(", ")}.
              </p>
            )}
          </div>
        </>
      )}
    </CartaoDoPainel>
  );
}
