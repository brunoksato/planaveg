import {
  StatusPill,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableRowHeader,
} from "@sinaveg/ui";

import type { Catalogo } from "@/shared/services/catalogo.service";
import { criterioDoGrupo, termoArranjo, termoCriterio, termoNivel } from "@/shared/utils/glossario";
import { separarArranjos } from "@/shared/utils/metas";
import { nivelUnicos } from "@/shared/utils/niveis";

import { Bloco } from "./Bloco";
import { NomeOficial } from "./NomeOficial";

/** Como os números são calculados: o que é contado, as categorias, os arranjos e os temas. */
export function VisaoMetodologia({ dados }: { dados: Catalogo }) {
  const niveis = nivelUnicos(dados.niveis);
  return (
    <>
      <Bloco
        descricao="O total soma as duas categorias de saída do relatório da metodologia (seção 4)."
        id="o-que-e-contado"
        titulo="O que é contado"
      >
        <ul className="list-disc space-y-3 pl-5 text-[15px]">
          <li>
            <strong className="font-semibold">
              Vegetação secundária em áreas legalmente protegidas.
            </strong>{" "}
            A vegetação nativa que voltou a crescer, do mapeamento da vegetação secundária, em
            Terras Indígenas, Unidades de Conservação, manguezais e nas APP, Reservas Legais e Áreas
            de Uso Restrito dos imóveis rurais do CAR.
          </li>
          <li>
            <strong className="font-semibold">Projetos de recuperação da vegetação nativa.</strong>{" "}
            Do Recooperar, do IBAMA, do PRADA dos imóveis em regularização ambiental no CAR, dos
            Projetos de Cooperação MMA e do Observatório da Restauração e Recuperação. Entram
            inteiras, mesmo onde a vegetação ainda não aparece no mapeamento.
          </li>
        </ul>
      </Bloco>
      <Bloco
        descricao="Quando uma área se encaixa em mais de uma categoria, vale a de maior prioridade, na ordem abaixo (Anexo 1 do relatório). Nas Áreas de Preservação Permanente, de Uso Restrito e de Reserva Legal, a área também é separada pela condição do cadastro do imóvel no CAR: analisado em conformidade (com ativos e em regularização), ou não analisado, em análise ou aguardando retificação."
        id="categorias"
        titulo="Cada área entra em uma categoria só"
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-right">Ordem</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead>Critério</TableHead>
              <TableHead>Dados</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {niveis.map((nivel) => {
              const termo = termoNivel(nivel.nivel, nivel.titulo);
              const nome = termo.nome;
              return (
                <TableRow key={nivel.nivel}>
                  <TableCell className="text-right tabular-nums">{nivel.tier}</TableCell>
                  <TableRowHeader>
                    <span className="flex items-start gap-2">
                      <span
                        aria-hidden
                        className="mt-1 size-3.5 shrink-0 rounded-[4px]"
                        style={{ backgroundColor: nivel.cor }}
                      />
                      <span>
                        {nome}
                        {termo.descricao === undefined ? null : (
                          <span className="mt-0.5 block text-sm font-normal text-muted-foreground">
                            {termo.descricao}
                          </span>
                        )}
                        <NomeOficial nome={nome} oficial={nivel.titulo} />
                      </span>
                    </span>
                  </TableRowHeader>
                  <TableCell>{termoCriterio(criterioDoGrupo(nivel.grupo)).nome}</TableCell>
                  <TableCell>
                    {nivel.presente ? (
                      <StatusPill tone="success">Com dados</StatusPill>
                    ) : (
                      <span title={nivel.motivo_ausencia ?? undefined}>
                        <StatusPill tone="neutral">Sem dados</StatusPill>
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Bloco>
      <Bloco
        descricao="O plano organiza a recuperação em três arranjos de implementação (Anexo 2 do relatório). Vale o primeiro arranjo, na ordem abaixo, cuja regra a área atende. O que não entra em nenhum fica nas demais áreas de projetos, que não têm meta própria."
        id="arranjos"
        titulo="E em um arranjo de implementação"
      >
        <ol className="space-y-5">
          {separarArranjos(dados.arranjos).doPlano.map((arranjo) => {
            const termo = termoArranjo(arranjo.arranjo, arranjo.titulo);
            return (
              <li className="flex items-start gap-3" key={arranjo.arranjo}>
                <span
                  aria-hidden
                  className="mt-1 size-3.5 shrink-0 rounded-[4px]"
                  style={{ backgroundColor: arranjo.cor }}
                />
                <span className="text-[15px]">
                  <span className="block font-semibold">
                    {arranjo.prioridade}. {termo.nome}
                  </span>
                  {termo.descricao === undefined ? null : (
                    <span className="block">{termo.descricao}</span>
                  )}
                  <span className="mt-1 block text-sm text-muted-foreground">
                    Regra: {arranjo.criterio}
                  </span>
                  {arranjo.motivo_ausencia === null ? null : (
                    <span className="mt-1 block text-sm text-muted-foreground">
                      {arranjo.motivo_ausencia}
                    </span>
                  )}
                </span>
              </li>
            );
          })}
        </ol>
      </Bloco>
      <Bloco
        descricao="Embargos, Terras Indígenas, assentamentos e outros temas marcam as áreas, e uma área pode estar em vários. Por isso, os valores dos temas não somam o total. Os temas estão logo abaixo."
        id="temas"
        titulo="Os temas do relatório se sobrepõem"
      />
    </>
  );
}
