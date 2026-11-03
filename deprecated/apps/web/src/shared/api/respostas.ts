import { HttpError } from "@sinaveg/web-contracts";

import type { Feicao, FeicaoClicada, Geometria } from "./geoserver";

/*
 * As respostas do GeoServer: o GeoJSON pedido, lido como linhas, feições ou o resultado de um
 * clique, ou o erro com a mensagem que o GeoServer mandou.
 */

/** O GeoJSON do WFS e do `GetFeatureInfo`. */
type RespostaGeoJson = {
  features?: Array<{ id?: string; properties?: unknown; geometry?: Geometria | null }>;
  /** O sistema das coordenadas, quando não é longitude/latitude (`urn:ogc:def:crs:EPSG::3857`). */
  crs?: { properties?: { name?: string } } | null;
};

/** Faz o pedido e lê o GeoJSON; qualquer outra resposta vira um `HttpError`. */
export async function lerGeoJson(
  fetcher: typeof fetch,
  url: string,
  signal?: AbortSignal,
): Promise<RespostaGeoJson> {
  const resposta = await fetcher(url, {
    headers: { Accept: "application/json" },
    ...(signal === undefined ? {} : { signal }),
  });
  const tipo = resposta.headers.get("content-type") ?? "";
  if (resposta.ok && tipo.includes("json")) return (await resposta.json()) as RespostaGeoJson;
  throw await erroDaResposta(resposta);
}

/** As linhas de uma tabela: só as propriedades de cada feição. */
export function linhasDe<P>(resposta: RespostaGeoJson): P[] {
  return (resposta.features ?? []).map((f) => (f.properties ?? {}) as P);
}

/** As feições de uma camada, com o id e a geometria. */
export function feicoesDe<P>(resposta: RespostaGeoJson): Feicao<P>[] {
  return (resposta.features ?? []).map((f) => ({
    id: f.id ?? "",
    propriedades: (f.properties ?? {}) as P,
    geometria: f.geometry ?? null,
  }));
}

/** As linhas de várias tabelas pedidas juntas, agrupadas pelo nome da tabela. */
export function linhasPorTabela(
  nomes: readonly string[],
  resposta: RespostaGeoJson,
): Record<string, unknown[]> {
  const grupos: Record<string, unknown[]> = Object.fromEntries(nomes.map((n) => [n, []]));
  for (const feicao of resposta.features ?? []) {
    // O id de cada feição começa pelo nome da tabela: `catalogo_ano.fid-…`.
    const tabela = (feicao.id ?? "").split(".")[0] ?? "";
    grupos[tabela]?.push(feicao.properties ?? {});
  }
  return grupos;
}

/** As feições sob o clique, cada uma com a camada e a geometria em longitude/latitude. */
export function feicoesDoClique<P>(resposta: RespostaGeoJson): FeicaoClicada<P>[] {
  // A geometria vem no `srs` do pedido, em metros: o contorno do mapa a quer em graus.
  const emMetros = /EPSG::?(3857|900913)\b/.test(resposta.crs?.properties?.name ?? "");
  return (resposta.features ?? []).map((f) => ({
    camada: (f.id ?? "").split(".")[0] ?? "",
    propriedades: (f.properties ?? {}) as P,
    geometria: emMetros ? emGraus(f.geometry ?? null) : (f.geometry ?? null),
  }));
}

const RAIO_WEB_MERCATOR = 6_378_137;

/** Uma geometria do Web Mercator (metros) em longitude/latitude. */
function emGraus(geometria: Geometria | null): Geometria | null {
  return geometria === null
    ? null
    : { ...geometria, coordinates: paraGraus(geometria.coordinates) };
}

/** Coordenadas do Web Mercator (metros) em longitude/latitude, em qualquer profundidade. */
function paraGraus(coordenadas: unknown): unknown {
  if (!Array.isArray(coordenadas)) return coordenadas;
  const [x, y, ...resto] = coordenadas as unknown[];
  if (typeof x === "number" && typeof y === "number") {
    const longitude = (x / RAIO_WEB_MERCATOR) * (180 / Math.PI);
    const latitude =
      (2 * Math.atan(Math.exp(y / RAIO_WEB_MERCATOR)) - Math.PI / 2) * (180 / Math.PI);
    return [longitude, latitude, ...resto];
  }
  return coordenadas.map(paraGraus);
}

/**
 * O erro de uma resposta que não é o GeoJSON pedido, com a mensagem do GeoServer quando ele a
 * manda: o WFS 2.0 responde 400 com um `ows:ExceptionReport`, e o WMS 1.1.1, 200 com um
 * `ServiceExceptionReport`. Um 5xx (o GeoServer fora do ar, a CDN) fica com a mensagem geral, e
 * um 200 sem JSON vale como 502.
 */
async function erroDaResposta(resposta: Response): Promise<HttpError> {
  if (resposta.status >= 500) {
    return new HttpError(resposta.status, "O GeoServer não respondeu a esta consulta.");
  }
  const status = resposta.ok ? 502 : resposta.status;
  const excecao = textoDaExcecao(await resposta.text().catch(() => ""));
  if (excecao !== undefined)
    return new HttpError(status, `O GeoServer recusou a consulta: ${excecao}`);
  return new HttpError(
    status,
    resposta.ok
      ? "O GeoServer devolveu uma resposta inesperada."
      : `O GeoServer recusou a consulta (erro ${String(resposta.status)}).`,
  );
}

/**
 * O texto da exceção de um `ows:ExceptionReport` (WFS 2.0) ou de um `ServiceExceptionReport`
 * (WMS 1.1.1). Só a primeira linha: a de um filtro inválido segue com a gramática inteira do CQL.
 */
function textoDaExcecao(xml: string): string | undefined {
  const bruto =
    /<ows:ExceptionText>([\s\S]*?)<\/ows:ExceptionText>/.exec(xml)?.[1] ??
    /<ServiceException\b[^>]*>([\s\S]*?)<\/ServiceException>/.exec(xml)?.[1];
  const linha = bruto?.trim().split(/\r?\n/)[0]?.replaceAll(/\s+/g, " ").trim();
  return linha === undefined || linha === "" ? undefined : semEntidades(linha);
}

const ENTIDADES: Readonly<Record<string, string>> = {
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&apos;": "'",
  "&amp;": "&",
};

/** As cinco entidades do XML de volta aos caracteres. */
function semEntidades(texto: string): string {
  return texto.replaceAll(
    /&(?:lt|gt|quot|apos|amp);/g,
    (entidade) => ENTIDADES[entidade] ?? entidade,
  );
}
