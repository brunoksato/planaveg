import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableRowHeader,
} from "@sinaveg/ui";
import type { CatalogoNivel } from "@sinaveg/web-contracts";

import type { Resumo } from "@/modules/filtros";
import { BarrasDivididas } from "@/shared/components/graficos/BarrasDivididas";
import { FiguraGrafico } from "@/shared/components/graficos/FiguraGrafico";
import { formatarInteiro, formatarParticipacao } from "@/shared/utils/formatos";
import { termoNivel } from "@/shared/utils/glossario";

import type { ContextoCsv } from "../../types";
import { AREA_MINIMA_HA, CONDICOES, CONDICOES_DO_CAR, NIVEIS_CAR } from "../../utils/constantes";
import { csvDoPainel } from "../../utils/csv";
import { CartaoDoPainel } from "./CartaoDoPainel";
import { SemArea } from "./SemArea";

/**
 * As APP, AUR e RL dos imóveis do CAR pelas duas condições do cadastro da planilha de
 * nomenclatura, com as situações do imóvel que a tabela de critérios do Planaveg conta em cada
 * uma.
 */
export function SecaoImoveisRurais({
  niveis,
  atual,
  contexto,
}: {
  niveis: readonly CatalogoNivel[];
  atual: Resumo;
  contexto: ContextoCsv;
}) {
  // Só os tipos com área (ao menos 0,1 ha arredondado): num lugar sem Áreas de Uso Restrito, ou
  // com só uma lasca delas, não há barra vazia.
  const tipos = NIVEIS_CAR.map((codigo) => {
    const oficial = niveis.find((n) => n.nivel === codigo)?.titulo ?? codigo;
    const condicoes = atual.porCondicao.get(codigo);
    const valores = Object.fromEntries(
      CONDICOES.map((c) => [c.chave, condicoes?.get(c.chave) ?? 0]),
    );
    const area = Object.values(valores).reduce((a, b) => a + b, 0);
    return { chave: codigo, rotulo: termoNivel(codigo, oficial).nome, valores, area };
  }).filter((tipo) => tipo.area >= AREA_MINIMA_HA);
  const total = tipos.reduce((soma, t) => soma + t.area, 0);
  const naoAnalisada = tipos.reduce((soma, t) => soma + (t.valores.nao_analisado ?? 0), 0);
  return (
    <CartaoDoPainel
      csv={
        total > 0
          ? csvDoPainel(
              contexto,
              "imoveis-rurais",
              "Baixar os dados por situação do cadastro (CSV)",
              ["codigo", "nome", ...CONDICOES.map((c) => `${c.chave}_ha`), "total_ha"],
              tipos.map((t) => [
                t.chave,
                t.rotulo,
                ...CONDICOES.map((c) => t.valores[c.chave] ?? 0),
                t.area,
              ]),
            )
          : undefined
      }
      explicacao="Situação do cadastro do imóvel no Cadastro Ambiental Rural (CAR), nas Áreas de Preservação Permanente, de Reserva Legal e de Uso Restrito."
      id="imoveis-rurais"
      indicador={
        total > 0
          ? {
              valor: formatarParticipacao(naoAnalisada / total),
              rotulo: "em cadastros não analisados ou em análise",
            }
          : undefined
      }
      tabela={total <= 0 ? undefined : <TabelaDosImoveis tipos={tipos} />}
      titulo="Imóveis rurais: situação do cadastro no CAR"
    >
      {total <= 0 ? (
        <SemArea texto="Nenhuma dessas áreas está em APP, Reserva Legal ou Área de Uso Restrito de imóveis rurais do CAR." />
      ) : (
        <FiguraGrafico mostrarTitulo={false} titulo="Imóveis rurais por situação do cadastro">
          <BarrasDivididas linhas={tipos} segmentos={CONDICOES} />
        </FiguraGrafico>
      )}
      <div className="mt-6 space-y-3 text-sm text-muted-foreground">
        {CONDICOES.map((condicao) => (
          <div key={condicao.chave}>
            <p className="font-medium text-foreground">{condicao.rotulo}</p>
            <ul aria-label={condicao.rotulo} className="mt-1 list-disc space-y-0.5 pl-5">
              {CONDICOES_DO_CAR[condicao.chave].map((situacao) => (
                <li key={situacao}>{situacao}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </CartaoDoPainel>
  );
}

/** A tabela dos tipos de área do CAR, com a área em cada condição do cadastro e o total. */
function TabelaDosImoveis({
  tipos,
}: {
  tipos: ReadonlyArray<{
    chave: string;
    rotulo: string;
    valores: Record<string, number>;
    area: number;
  }>;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Tipo de área</TableHead>
          {CONDICOES.map((c) => (
            <TableHead className="text-right" key={c.chave}>
              {c.rotulo} (ha)
            </TableHead>
          ))}
          <TableHead className="text-right">Total (ha)</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {tipos.map((t) => (
          <TableRow key={t.chave}>
            <TableRowHeader>{t.rotulo}</TableRowHeader>
            {CONDICOES.map((c) => (
              <TableCell className="text-right tabular-nums" key={c.chave}>
                {formatarInteiro(t.valores[c.chave] ?? 0)}
              </TableCell>
            ))}
            <TableCell className="text-right font-medium tabular-nums">
              {formatarInteiro(t.area)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
