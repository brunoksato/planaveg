import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableRowHeader,
} from "@sinaveg/ui";

import { formatarInteiro, formatarParte } from "@/shared/utils/formatos";

/** Tabela de área e participação no total, com o nome oficial sob o nome simples. */
export function TabelaParticipacao({
  nome,
  colunaGrupo,
  linhas,
  total,
}: {
  /** Título da primeira coluna. */
  nome: string;
  /** Título da coluna de grupo; sem ele, a tabela não tem essa coluna. */
  colunaGrupo?: string;
  linhas: ReadonlyArray<{
    chave: string;
    nome: string;
    oficial?: string | undefined;
    grupo?: string | undefined;
    valor: number;
  }>;
  total: number;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{nome}</TableHead>
          {colunaGrupo === undefined ? null : <TableHead>{colunaGrupo}</TableHead>}
          <TableHead className="text-right">Área (ha)</TableHead>
          <TableHead className="text-right">Do total</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {linhas.map((linha) => (
          <TableRow key={linha.chave}>
            <TableRowHeader>
              {linha.nome}
              {linha.oficial === undefined ? null : (
                <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
                  {linha.oficial}
                </span>
              )}
            </TableRowHeader>
            {colunaGrupo === undefined ? null : <TableCell>{linha.grupo}</TableCell>}
            <TableCell className="text-right tabular-nums">
              {formatarInteiro(linha.valor)}
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {formatarParte(linha.valor, total)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
