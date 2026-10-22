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
import { nomeGrupoDeFiltro } from "@/shared/utils/glossario";

import { SITUACAO } from "../utils/situacao";
import { Bloco } from "./Bloco";

/** Os temas do relatório: onde cada um aparece e se os dados estão completos. */
export function VisaoFiltros({ dados }: { dados: Catalogo }) {
  return (
    <Bloco
      descricao="Na ordem do relatório. Os temas com camada aparecem no mapa e no painel; os outros, só no painel."
      id="temas-relatorio"
      titulo="Os temas"
    >
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Tema</TableHead>
            <TableHead>Grupo</TableHead>
            <TableHead>Onde aparece</TableHead>
            <TableHead>Dados</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {dados.filtros.map((filtro) => {
            return (
              <TableRow key={filtro.filtro}>
                <TableRowHeader>
                  <span className="flex items-start gap-2">
                    <span
                      aria-hidden
                      className="mt-1 size-3.5 shrink-0 rounded-[4px]"
                      style={{ backgroundColor: filtro.cor }}
                    />
                    <span>
                      {filtro.titulo}
                      {filtro.subtitulo === null ? null : (
                        <span className="block text-xs font-normal text-muted-foreground">
                          {filtro.subtitulo}
                        </span>
                      )}
                      {filtro.nota === null ? null : (
                        <span className="block text-xs font-normal text-muted-foreground">
                          {filtro.nota}
                        </span>
                      )}
                    </span>
                  </span>
                </TableRowHeader>
                <TableCell>{nomeGrupoDeFiltro(filtro.grupo)}</TableCell>
                <TableCell>{filtro.espacial ? "no mapa e no painel" : "só no painel"}</TableCell>
                <TableCell>
                  <StatusPill tone={SITUACAO[filtro.status].tom}>
                    {SITUACAO[filtro.status].rotulo}
                  </StatusPill>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </Bloco>
  );
}
