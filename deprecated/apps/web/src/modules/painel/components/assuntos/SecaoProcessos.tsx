import { PROCESSOS, type Resumo } from "@/modules/filtros";
import { FiguraGrafico } from "@/shared/components/graficos/FiguraGrafico";
import { Rosca } from "@/shared/components/graficos/Rosca";
import { formatarHectaresResumido } from "@/shared/utils/formatos";
import { termoProcesso } from "@/shared/utils/glossario";
import { somar } from "@/shared/utils/numeros";

import type { ContextoCsv } from "../../types";
import { participacao } from "../../utils/assuntos";
import { COR_PROCESSO } from "../../utils/constantes";
import { csvDoPainel } from "../../utils/csv";
import { CartaoDoPainel } from "./CartaoDoPainel";
import { SemArea } from "./SemArea";
import { TabelaParticipacao } from "./TabelaParticipacao";

/**
 * Os projetos de recuperação pelo processo que os criou, como no Anexo 2 do relatório: embargo,
 * reparação de danos, licenciamento e outros. Cada área entra num processo só.
 */
export function SecaoProcessos({ atual, contexto }: { atual: Resumo; contexto: ContextoCsv }) {
  const fatias = PROCESSOS.map((processo) => {
    const termo = termoProcesso(processo);
    return {
      chave: processo,
      rotulo: termo.nome,
      descricao: termo.descricao,
      cor: COR_PROCESSO[processo],
      valor: atual.porProcesso.get(processo) ?? 0,
      termo,
    };
  });
  const total = somar(fatias);
  return (
    <CartaoDoPainel
      csv={
        total <= 0
          ? undefined
          : csvDoPainel(
              contexto,
              "projetos",
              "Baixar os dados por processo (CSV)",
              ["processo", "nome", "area_ha", "do_total"],
              fatias.map((f) => [f.chave, f.rotulo, f.valor, participacao(f.valor, total)]),
            )
      }
      explicacao="Embargos, reparação de danos e licenciamento são do Recooperar. PRADA, Projetos de Cooperação MMA, Observatório da Restauração e Recuperação e demais projetos ficam em outros."
      id="projetos"
      indicador={
        total > 0
          ? { valor: formatarHectaresResumido(total), rotulo: "em projetos de recuperação" }
          : undefined
      }
      tabela={
        total <= 0 ? undefined : (
          <TabelaParticipacao
            linhas={fatias.map((f) => ({ chave: f.chave, nome: f.rotulo, valor: f.valor }))}
            nome="Processo"
            total={total}
          />
        )
      }
      titulo="Projetos de recuperação por processo"
    >
      {total <= 0 ? (
        <SemArea texto="Nenhuma dessas áreas está em projeto de recuperação." />
      ) : (
        <FiguraGrafico mostrarTitulo={false} titulo="Projetos de recuperação por processo">
          <Rosca fatias={fatias} rotuloTotal="em projetos" />
        </FiguraGrafico>
      )}
    </CartaoDoPainel>
  );
}
