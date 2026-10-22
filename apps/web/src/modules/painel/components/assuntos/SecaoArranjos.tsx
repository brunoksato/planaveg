import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableRowHeader,
} from "@sinaveg/ui";

import type { Resumo } from "@/modules/filtros";
import type { Catalogo } from "@/shared/services/catalogo.service";
import {
  formatarHectaresResumido,
  formatarInteiro,
  formatarParticipacao,
} from "@/shared/utils/formatos";
import { termoArranjo } from "@/shared/utils/glossario";
import {
  notaDoResto,
  type ProgressoDasMetas,
  progressoDasMetas,
  separarArranjos,
} from "@/shared/utils/metas";

import type { ContextoCsv } from "../../types";
import { legendaDoArranjo } from "../../utils/arranjos";
import { participacao } from "../../utils/assuntos";
import { type Csv, csvDoPainel, tabelaCsv } from "../../utils/csv";
import { CartaoDoPainel } from "./CartaoDoPainel";
import { ItemArranjo, type LinhaArranjo } from "./ItemArranjo";
import { SemArea } from "./SemArea";
import { TabelaParticipacao } from "./TabelaParticipacao";

/** O total das metas: a área, a meta nacional, a parte já atingida e o ano. */
type TotalDasMetas = ProgressoDasMetas["total"];

/**
 * Os três arranjos de implementação do Planaveg, cada um com o nome, os critérios de
 * elegibilidade e o atributo espacial da tabela dos arranjos. No Brasil inteiro e sem filtros, a
 * barra é o progresso até a meta de 2030 (Figura 4 do relatório técnico); senão, a parte de cada
 * um na área, e o cartão diz por que não há progresso. As demais áreas de projetos não têm caixa:
 * uma nota diz quanto são, e as tabelas as trazem numa linha, para a soma fechar.
 */
export function SecaoArranjos({
  arranjos,
  atual,
  contexto,
  metas,
}: {
  arranjos: Catalogo["arranjos"];
  atual: Resumo;
  contexto: ContextoCsv;
  metas: boolean;
}) {
  const progresso = metas ? progressoDasMetas(arranjos, atual.porArranjo) : undefined;
  const linha = (a: Catalogo["arranjos"][number]): LinhaArranjo => {
    const legenda = legendaDoArranjo(a.arranjo, a.motivo_ausencia);
    const item = progresso?.itens.find((i) => i.arranjo === a.arranjo);
    return {
      chave: a.arranjo,
      titulo: termoArranjo(a.arranjo, a.titulo).nome,
      cor: a.cor,
      area: atual.porArranjo.get(a.arranjo) ?? 0,
      elegibilidade: legenda.elegibilidade,
      atributo: legenda.atributo,
      nota: legenda.nota,
      meta: item === undefined ? undefined : { meta: item.meta, fracao: item.fracao },
    };
  };
  const { doPlano, resto } = separarArranjos(arranjos);
  const caixas = doPlano.map(linha);
  const restos = resto.map(linha);
  // As tabelas e o CSV levam também as demais áreas de projetos: com elas, a soma é o total.
  const linhas = [...caixas, ...restos];
  const soma = linhas.reduce((total, l) => total + l.area, 0);
  const lista = (
    <ListaDosArranjos
      caixas={caixas}
      comMetas={progresso !== undefined}
      restos={restos}
      soma={soma}
    />
  );

  if (progresso !== undefined) {
    const { total } = progresso;
    return (
      <CartaoDoPainel
        csv={csvDasMetas(contexto, linhas, total)}
        // O ano das metas vem do catálogo (`meta_ano`): nada de período escrito aqui.
        explicacao={`Estimativa técnica. Metas do Planaveg para ${total.ano} (Figura 4 do relatório técnico); cada área entra em um arranjo só.`}
        id="arranjos"
        indicador={{
          valor: formatarParticipacao(total.fracao),
          rotulo: `da meta de ${formatarHectaresResumido(total.meta)} até ${total.ano}`,
        }}
        largura="inteira"
        tabela={<TabelaDasMetas linhas={linhas} total={total} />}
        titulo={`Metas de ${total.ano} por arranjo de implementação`}
      >
        {lista}
      </CartaoDoPainel>
    );
  }
  return (
    <CartaoDoPainel
      csv={csvDoPainel(
        contexto,
        "arranjos",
        "Baixar os dados por arranjo (CSV)",
        ["codigo", "nome", "area_ha", "do_total"],
        linhas
          .filter((l) => l.area > 0)
          .map((l) => [l.chave, l.titulo, l.area, participacao(l.area, soma)]),
      )}
      explicacao="O plano divide a recuperação em arranjos de implementação, conforme o tipo de terra; cada área entra em um só. As metas são nacionais: o progresso até elas aparece no Brasil inteiro, sem filtros."
      id="arranjos"
      largura="inteira"
      tabela={
        soma <= 0 ? undefined : (
          <TabelaParticipacao
            linhas={linhas.map((l) => ({ chave: l.chave, nome: l.titulo, valor: l.area }))}
            nome="Arranjo de implementação"
            total={soma}
          />
        )
      }
      titulo="Arranjos de implementação"
    >
      {soma <= 0 ? <SemArea /> : lista}
    </CartaoDoPainel>
  );
}

/** Uma caixa por arranjo do plano e, embaixo, a nota de cada resto com área. */
function ListaDosArranjos({
  caixas,
  restos,
  soma,
  comMetas,
}: {
  caixas: readonly LinhaArranjo[];
  restos: readonly LinhaArranjo[];
  soma: number;
  comMetas: boolean;
}) {
  return (
    <>
      <ul
        aria-label={comMetas ? "Progresso de cada arranjo até a meta" : "Área de cada arranjo"}
        className="space-y-7"
      >
        {caixas.map((l) => (
          <ItemArranjo key={l.chave} linha={l} total={soma} />
        ))}
      </ul>
      {restos
        .filter((l) => l.area > 0)
        .map((l) => (
          <p className="mt-7 text-sm text-muted-foreground" key={l.chave}>
            {notaDoResto(l.titulo, l.area, soma)}
          </p>
        ))}
    </>
  );
}

/** O CSV das metas: cada arranjo e o total, com a meta e a parte já atingida. */
function csvDasMetas(
  contexto: ContextoCsv,
  linhas: readonly LinhaArranjo[],
  total: TotalDasMetas,
): Csv {
  const { ano, lugar } = contexto;
  return tabelaCsv(
    "Baixar o progresso das metas (CSV)",
    `painel-metas-${contexto.arquivo}-${ano}`,
    ["ano", "lugar", "codigo", "nome", "area_ha", "meta_ha", "ano_da_meta", "da_meta"],
    [
      ...linhas.map((l) => [
        ano,
        lugar,
        l.chave,
        l.titulo,
        l.area,
        l.meta?.meta ?? null,
        l.meta === undefined ? null : total.ano,
        l.meta?.fracao ?? null,
      ]),
      [ano, lugar, null, "Total", total.area, total.meta, total.ano, total.fracao],
    ],
  );
}

/** A tabela das metas: a área, a meta e a parte já atingida de cada arranjo e do total. */
function TabelaDasMetas({
  linhas,
  total,
}: {
  linhas: readonly LinhaArranjo[];
  total: TotalDasMetas;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Arranjo de implementação</TableHead>
          <TableHead className="text-right">Área (ha)</TableHead>
          <TableHead className="text-right">Meta (ha)</TableHead>
          <TableHead className="text-right">Da meta</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {linhas.map((l) => (
          <TableRow key={l.chave}>
            <TableRowHeader>{l.titulo}</TableRowHeader>
            <TableCell className="text-right tabular-nums">{formatarInteiro(l.area)}</TableCell>
            <TableCell className="text-right tabular-nums">
              {l.meta === undefined ? "—" : formatarInteiro(l.meta.meta)}
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {l.meta === undefined ? "—" : formatarParticipacao(l.meta.fracao)}
            </TableCell>
          </TableRow>
        ))}
        <TableRow className="font-semibold">
          <TableRowHeader>Total</TableRowHeader>
          <TableCell className="text-right tabular-nums">{formatarInteiro(total.area)}</TableCell>
          <TableCell className="text-right tabular-nums">{formatarInteiro(total.meta)}</TableCell>
          <TableCell className="text-right tabular-nums">
            {formatarParticipacao(total.fracao)}
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>
  );
}
