import type { ConsultaPonto, FormatoDownload, OpcoesIdentificacao, OpcoesWfs } from "./geoserver";

/*
 * Os parâmetros de cada pedido ao GeoServer: o WFS das tabelas e dos downloads e o WMS do clique
 * (`GetFeatureInfo`). Os nomes das camadas chegam qualificados (`workspace:camada`), e quem põe a
 * versão dos dados é o cliente (`geoserver.ts`).
 */

/** O `outputFormat` do WFS de cada formato de download. */
export const FORMATOS: Record<FormatoDownload, string> = {
  csv: "csv",
  json: "application/json",
  "shape-zip": "shape-zip",
};

/** A consulta WFS 2.0 de uma tabela, com o filtro, as colunas, a ordem e o limite pedidos. */
export function parametrosWfs(tabela: string, opcoes: OpcoesWfs): URLSearchParams {
  const params = new URLSearchParams({
    service: "WFS",
    version: "2.0.0",
    request: "GetFeature",
    typeNames: tabela,
  });
  if (temFiltro(opcoes.cql)) params.set("CQL_FILTER", opcoes.cql);
  if (opcoes.propriedades !== undefined && opcoes.propriedades.length > 0) {
    params.set("propertyName", opcoes.propriedades.join(","));
  }
  if (opcoes.ordenarPor !== undefined) params.set("sortBy", ordenacaoWfs(opcoes.ordenarPor));
  if (opcoes.limite !== undefined) params.set("count", String(opcoes.limite));
  return params;
}

/** Várias tabelas inteiras numa consulta WFS 2.0 só, uma consulta por tabela. */
export function parametrosDasTabelas(tabelas: readonly string[]): URLSearchParams {
  return new URLSearchParams({
    service: "WFS",
    version: "2.0.0",
    request: "GetFeature",
    // `(a)(b)` são consultas separadas; `a,b` seria uma junção.
    typeNames: tabelas.map((tabela) => `(${tabela})`).join(""),
    outputFormat: "application/json",
  });
}

/** O `GetFeatureInfo` (WMS 1.1.1) de um clique nas camadas. */
export function parametrosDoClique(
  camadas: readonly string[],
  consulta: ConsultaPonto,
  opcoes: OpcoesIdentificacao,
): URLSearchParams {
  const nomes = camadas.join(",");
  const params = new URLSearchParams({
    service: "WMS",
    version: "1.1.1",
    request: "GetFeatureInfo",
    layers: nomes,
    query_layers: nomes,
    styles: "",
    srs: "EPSG:3857",
    bbox: consulta.bbox.join(","),
    width: String(Math.round(consulta.largura)),
    height: String(Math.round(consulta.altura)),
    x: String(Math.round(consulta.x)),
    y: String(Math.round(consulta.y)),
    info_format: "application/json",
    feature_count: String(opcoes.limite ?? 10),
  });
  if (temFiltro(opcoes.cql)) params.set("CQL_FILTER", opcoes.cql);
  if (opcoes.parametros !== undefined) {
    const pares = Object.entries(opcoes.parametros).map(([nome, v]) => `${nome}:${String(v)}`);
    params.set("viewparams", pares.join(";"));
  }
  if (opcoes.propriedades !== undefined && opcoes.propriedades.length > 0) {
    // Um grupo por camada consultada, como o GeoServer pede para várias camadas.
    const grupo = `(${opcoes.propriedades.join(",")})`;
    params.set("propertyName", camadas.map(() => grupo).join(""));
  }
  return params;
}

/** Põe a versão dos dados no pedido (`v=`); sem versão, nada. */
export function comVersao(params: URLSearchParams, versao: string | undefined): URLSearchParams {
  if (versao !== undefined) params.set("v", versao);
  return params;
}

/** Há filtro: um `cql` vazio vale como nenhum (iria como `CQL_FILTER=`). */
export function temFiltro(cql: string | undefined): cql is string {
  return cql !== undefined && cql.trim().length > 0;
}

/** `area_ha DESC, titulo` → `area_ha D,titulo A`, a sintaxe de `sortBy` do WFS 2.0. */
function ordenacaoWfs(ordem: string): string {
  return ordem
    .split(",")
    .map((parte) => parte.trim())
    .filter((parte) => parte.length > 0)
    .map((parte) => {
      const [coluna = "", sentido = "ASC"] = parte.split(/\s+/);
      return `${coluna} ${sentido.toUpperCase().startsWith("D") ? "D" : "A"}`;
    })
    .join(",");
}
