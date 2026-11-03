import { StatusPill } from "@sinaveg/ui";

import type { GeoServerApi } from "@/shared/api/geoserver";

import { Bloco } from "./Bloco";

/**
 * Os documentos que a revisão da MMA de 16/10/2026 pede nos serviços web. Sem o endereço, o
 * documento aparece como "a publicar": os links ainda não chegaram.
 */
const DOCUMENTOS: ReadonlyArray<{ nome: string; descricao: string; href?: string }> = [
  {
    nome: "Resoluções da Conaveg",
    descricao: "As resoluções sobre a metodologia de monitoramento.",
  },
  {
    nome: "Planaveg",
    descricao: "O Plano Nacional de Recuperação da Vegetação Nativa.",
  },
  {
    nome: "Relatório da metodologia",
    descricao: "Como as áreas são classificadas e contadas.",
  },
];

/**
 * Usar no QGIS e em outros sistemas: os endereços WMS e WFS e como usá-los; e os documentos da
 * metodologia.
 */
export function VisaoServicos({ geoserver }: { geoserver: GeoServerApi }) {
  return (
    <>
      <Bloco
        descricao="Mapas por WMS e dados por WFS, com os mesmos números do portal."
        id="enderecos"
        titulo="Endereços"
      >
        <dl className="grid gap-x-6 gap-y-3 text-[15px] sm:grid-cols-[auto_minmax(0,1fr)]">
          <dt className="font-medium text-muted-foreground">WMS (mapas)</dt>
          <dd className="font-mono text-sm break-all">{geoserver.urlWms}</dd>
          <dt className="font-medium text-muted-foreground">WFS (dados)</dt>
          <dd className="font-mono text-sm break-all">{geoserver.urlOws}</dd>
          <dt className="font-medium text-muted-foreground">Workspace</dt>
          <dd className="font-mono text-sm">{geoserver.workspace}</dd>
        </dl>
      </Bloco>
      <Bloco id="como-usar" titulo="Como usar">
        <ul className="list-disc space-y-3 pl-5 text-[15px] leading-relaxed">
          <li>
            No QGIS, adicione uma conexão WMS/WMTS ou WFS com os endereços acima. Cada camada do
            mapa aparece com o título do portal.
          </li>
          <li>
            Camadas por ano: <code>peca_&lt;ano&gt;</code> (todas as áreas, estilos{" "}
            <code>planaveg_nivel</code> e <code>planaveg_arranjo</code>) e{" "}
            <code>espacial_&lt;filtro&gt;_&lt;ano&gt;</code> (um tema do relatório).
          </li>
          <li>
            A camada <code>peca</code> tem todos os anos e aceita filtro CQL, por exemplo{" "}
            <code>ano_vs=2024 AND nivel=&apos;app&apos;</code>.
          </li>
          <li>
            As tabelas <code>quantitativo_*</code>, <code>serie</code> e <code>catalogo_*</code>{" "}
            saem só por WFS (sem geometria), em JSON ou CSV.
          </li>
          <li>
            A situação do cadastro no CAR vem com o nome da planilha de nomenclatura em{" "}
            <code>situacao_cadastro</code>. As colunas <code>categoria</code> e{" "}
            <code>hierarquia</code> e as marcas do CAR (<code>car_*</code>, <code>app_*</code>,{" "}
            <code>rl_*</code> e <code>aur_*</code>) trazem as condições como o arquivo as nomeia:
            Habilitado é o cadastro analisado, em conformidade com a Lei nº 12.651/2012, com ativos
            e em regularização; Analisado e Não Analisado são os não analisados, em análise ou
            aguardando retificação.
          </li>
        </ul>
        <p className="mt-5 border-t pt-4 text-[15px]">
          Exemplo:{" "}
          <a
            className="break-all text-primary hover:underline"
            href={geoserver.urlDownload("quantitativo_categoria", "json")}
          >
            área por categoria em JSON
          </a>
        </p>
      </Bloco>
      <Bloco id="documentos" titulo="Documentos">
        <ul className="divide-y text-[15px]">
          {DOCUMENTOS.map((documento) => (
            <li
              className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 py-3 first:pt-0 last:pb-0"
              key={documento.nome}
            >
              <span>
                {documento.href === undefined ? (
                  <span className="font-medium">{documento.nome}</span>
                ) : (
                  <a className="font-medium text-primary hover:underline" href={documento.href}>
                    {documento.nome}
                  </a>
                )}
                <span className="block text-muted-foreground">{documento.descricao}</span>
              </span>
              {documento.href === undefined ? (
                <StatusPill tone="neutral">A publicar</StatusPill>
              ) : null}
            </li>
          ))}
        </ul>
      </Bloco>
    </>
  );
}
