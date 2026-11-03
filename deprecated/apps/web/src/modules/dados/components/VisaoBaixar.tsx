import type { GeoServerApi } from "@/shared/api/geoserver";
import type { Catalogo } from "@/shared/services/catalogo.service";

import { ATRIBUTOS_DAS_AREAS } from "../utils/camadas";
import { TABELAS_PARA_BAIXAR } from "../utils/tabelas";
import { Bloco } from "./Bloco";
import { LinkArquivo } from "./LinkArquivo";

/** Baixar os dados: as tabelas de números e as áreas mapeadas de cada ano. */
export function VisaoBaixar({ dados, geoserver }: { dados: Catalogo; geoserver: GeoServerApi }) {
  const areasPorAno = dados.camadas.filter((c) => c.tipo === "peca" && c.ano_vs !== null);
  return (
    <>
      <Bloco
        descricao="As tabelas prontas do GeoServer, inteiras e sem filtro: os totais que o painel mostra sem filtros (ele os soma das áreas de cada combinação de filtros). Com um lugar ou filtros, baixe o CSV do cartão, no painel. O CSV abre em qualquer planilha; o JSON serve a sistemas."
        id="numeros"
        titulo="Os números"
      >
        <ul className="divide-y">
          {TABELAS_PARA_BAIXAR.map((item) => (
            <li
              className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 py-3.5 first:pt-0 last:pb-0"
              key={item.tabela}
            >
              <span className="min-w-0">
                <span className="block text-[15px] font-medium">{item.nome}</span>
                <span className="block text-sm text-muted-foreground">{item.descricao}</span>
              </span>
              <span className="flex gap-4">
                <LinkArquivo
                  formato="CSV"
                  href={geoserver.urlDownload(item.tabela, "csv")}
                  nome={item.nome}
                />
                <LinkArquivo
                  formato="JSON"
                  href={geoserver.urlDownload(item.tabela, "json")}
                  nome={item.nome}
                />
              </span>
            </li>
          ))}
        </ul>
      </Bloco>
      <Bloco
        descricao="Uma linha por área, com a categoria, o arranjo, a área em hectares e o lugar. Sem o desenho das áreas: para ele, use os serviços para QGIS."
        id="areas"
        titulo="As áreas mapeadas"
      >
        <ul className="flex flex-wrap gap-x-6 gap-y-3">
          {areasPorAno.map((camada) => (
            <li key={camada.camada}>
              <LinkArquivo
                formato="CSV"
                href={geoserver.urlDownload(camada.camada, "csv", {
                  propriedades: ATRIBUTOS_DAS_AREAS,
                })}
                nome={`Áreas de ${String(camada.ano_vs)}`}
                visivel
              />
            </li>
          ))}
        </ul>
      </Bloco>
    </>
  );
}
