import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableRowHeader,
} from "@sinaveg/ui";

import type { GeoServerApi } from "@/shared/api/geoserver";
import type { Catalogo } from "@/shared/services/catalogo.service";
import { formatarInteiro } from "@/shared/utils/formatos";

import { anoDaCamada, ATRIBUTOS_DAS_AREAS, nomeCamada } from "../utils/camadas";
import { Bloco } from "./Bloco";
import { LinkArquivo } from "./LinkArquivo";

/** As camadas do mapa: cada view publicada, com o número de áreas e o CSV dos atributos. */
export function VisaoCamadas({ dados, geoserver }: { dados: Catalogo; geoserver: GeoServerApi }) {
  return (
    <Bloco
      descricao="Cada camada é uma view publicada no GeoServer. O CSV traz os atributos das áreas, sem o desenho; para ele, use os serviços para QGIS."
      id="camadas-mapa"
      titulo="As camadas"
    >
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Camada</TableHead>
            <TableHead>Ano</TableHead>
            <TableHead className="text-right">Áreas</TableHead>
            <TableHead className="text-right">Área (ha)</TableHead>
            <TableHead>Baixar</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {dados.camadas.map((camada) => (
            <TableRow key={camada.camada}>
              <TableRowHeader>
                <span className="flex items-start gap-2">
                  {camada.cor === null ? null : (
                    <span
                      aria-hidden
                      className="mt-1 size-3.5 shrink-0 rounded-[4px]"
                      style={{ backgroundColor: camada.cor }}
                    />
                  )}
                  <span>
                    <span className="block">{nomeCamada(camada)}</span>
                    <span className="block font-mono text-xs font-normal text-muted-foreground">
                      {camada.camada}
                    </span>
                  </span>
                </span>
              </TableRowHeader>
              <TableCell className="whitespace-nowrap">{anoDaCamada(camada)}</TableCell>
              <TableCell className="text-right tabular-nums">
                {formatarInteiro(camada.n_feicoes)}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {camada.area_ha === null ? "—" : formatarInteiro(camada.area_ha)}
              </TableCell>
              <TableCell>
                {camada.tipo === "municipio" ? null : (
                  <LinkArquivo
                    formato="CSV"
                    href={geoserver.urlDownload(camada.camada, "csv", {
                      propriedades: ATRIBUTOS_DAS_AREAS,
                    })}
                    nome={nomeCamada(camada)}
                  />
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Bloco>
  );
}
