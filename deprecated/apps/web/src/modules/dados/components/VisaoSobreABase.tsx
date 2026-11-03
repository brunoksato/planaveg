import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableRowHeader,
} from "@sinaveg/ui";

import type { Catalogo } from "@/shared/services/catalogo.service";
import { formatarInteiro } from "@/shared/utils/formatos";

import { Bloco } from "./Bloco";

const DATA = new Intl.DateTimeFormat("pt-BR", { dateStyle: "long", timeStyle: "short" });

/** Sobre a base: o arquivo carregado, como ele é identificado, e os anos que traz. */
export function VisaoSobreABase({ dados }: { dados: Catalogo }) {
  const fonte = dados.fonte;
  return (
    <>
      <Bloco
        descricao="O arquivo final do Planaveg, como o planaveg_core o carregou e conferiu. Os números dele são uma estimativa técnica: viram resultado oficial do Planaveg depois de aprovados pelo Plenário da Conaveg e publicados pelo MMA. O código SHA-256 identifica o arquivo: qualquer mudança nele muda o código."
        id="base-vigente"
        titulo="O arquivo"
      >
        {fonte === null ? (
          <p className="text-[15px] text-muted-foreground">Nenhuma base carregada.</p>
        ) : (
          <dl className="grid gap-x-6 gap-y-3 text-[15px] sm:grid-cols-[auto_minmax(0,1fr)]">
            <dt className="font-medium text-muted-foreground">Arquivo</dt>
            <dd className="break-all">{fonte.arquivo}</dd>
            <dt className="font-medium text-muted-foreground">SHA-256</dt>
            <dd className="font-mono text-sm break-all">{fonte.sha256}</dd>
            <dt className="font-medium text-muted-foreground">Carregado em</dt>
            <dd>{DATA.format(new Date(fonte.concluida_em))}</dd>
            <dt className="font-medium text-muted-foreground">Áreas mapeadas</dt>
            <dd>{fonte.pecas === null ? "—" : formatarInteiro(fonte.pecas)}</dd>
            <dt className="font-medium text-muted-foreground">Contrato</dt>
            <dd>categorias {fonte.contrato}</dd>
          </dl>
        )}
      </Bloco>
      <Bloco
        descricao="Cada camada do arquivo é um ano: a vegetação secundária mapeada naquele ano e as áreas de projetos. Os anos não se somam. O mapa e o painel mostram o mais recente; os outros ficam nos downloads e nos serviços web."
        id="anos"
        titulo="Os anos"
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ano</TableHead>
              <TableHead>Camada do arquivo</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {dados.anos.map((ano) => (
              <TableRow key={ano.ano_vs}>
                <TableRowHeader>{ano.ano_vs}</TableRowHeader>
                <TableCell className="font-mono text-sm">{ano.camada}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Bloco>
    </>
  );
}
