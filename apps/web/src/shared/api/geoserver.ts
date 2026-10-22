import {
  comVersao,
  FORMATOS,
  parametrosDasTabelas,
  parametrosDoClique,
  parametrosWfs,
  temFiltro,
} from "./pedidos";
import { feicoesDe, feicoesDoClique, lerGeoJson, linhasDe, linhasPorTabela } from "./respostas";

/**
 * Cliente do GeoServer do planaveg_core: WMTS para os tiles do mapa, WMS para o contorno do
 * município e o clique, WFS para todo o resto.
 *
 * O portal não tem API própria. As tabelas sem geometria (quantitativos, série, catálogo) são
 * feature types do GeoServer e chegam por `GetFeature&outputFormat=application/json`; os tiles
 * saem prontos do GeoWebCache (`urlTiles`) e o clique, por `GetFeatureInfo`. O GeoJSON do WFS
 * vem em longitude/latitude; o do `GetFeatureInfo` vem no `srs` do pedido (o Web Mercator da
 * tela), e `identificar` o devolve em longitude/latitude, como o do WFS.
 *
 * Com a versão dos dados definida (`definirVersaoDosDados`), toda consulta leva `v=<versão>` na
 * URL: o conteúdo de uma URL nunca muda, e a CDN pode guardá-la para sempre, sem limpeza depois
 * de uma base nova (a versão muda, e as URLs com ela). Só a consulta que lê a versão vai sem ela
 * (`semVersao`), e fica um minuto na CDN. Enquanto a base é atualizada, o servidor não dá versão
 * (`fonte_vigente` vem com ela nula): tudo vai sem `v=` e fica pouco tempo em cache.
 *
 * Este arquivo tem o que as telas usam: os tipos e o cliente. Os parâmetros de cada pedido estão
 * em `pedidos.ts`, e a leitura das respostas e dos erros, em `respostas.ts`.
 */

/** Geometria GeoJSON em longitude/latitude, como o portal a usa. */
export type Geometria = { type: string; coordinates: unknown };

export type OpcoesWfs = {
  /** Filtro em ECQL, aplicado no servidor (`CQL_FILTER`). */
  cql?: string | undefined;
  /** Só estas colunas; sem geometria, a resposta fica pequena. */
  propriedades?: readonly string[] | undefined;
  /** `coluna` ou `coluna DESC`, separados por vírgula. */
  ordenarPor?: string | undefined;
  limite?: number | undefined;
  signal?: AbortSignal | undefined;
  /** Sem a versão dos dados na URL: só a consulta que a lê, para ver uma base nova. */
  semVersao?: boolean | undefined;
};

export type Feicao<P> = {
  id: string;
  propriedades: P;
  geometria: Geometria | null;
};

/**
 * Clique no mapa em coordenadas de tela, como o WMS 1.1.1 pede, no Web Mercator da própria tela
 * (EPSG:3857): a caixa da vista em metros, o tamanho do mapa e o pixel clicado. O GeoServer
 * interpola o pixel em linha reta na caixa; em graus (EPSG:4326), a latitude consultada saía até
 * 2° da clicada nos zooms baixos.
 */
export type ConsultaPonto = {
  bbox: readonly [number, number, number, number];
  largura: number;
  altura: number;
  x: number;
  y: number;
};

export type FormatoDownload = "csv" | "json" | "shape-zip";

export type OpcoesIdentificacao = {
  propriedades?: readonly string[];
  limite?: number;
  /** Só as feições que atendem este filtro (o mesmo do mapa). */
  cql?: string | undefined;
  /**
   * Os parâmetros de uma consulta com parâmetros do GeoServer (`viewparams`), como a dos
   * polígonos de uma peça, que só responde com a peça na URL. Só números: o GeoServer recusa o
   * resto.
   */
  parametros?: Readonly<Record<string, number>>;
  signal?: AbortSignal;
};

/** Uma feição sob o clique: a camada de onde veio, as propriedades e a geometria. */
export type FeicaoClicada<P> = { camada: string; propriedades: P; geometria: Geometria | null };

export type GeoServerApi = {
  /** Endpoint WMS do workspace, para `L.tileLayer.wms`. */
  readonly urlWms: string;
  /** Endpoint OWS do workspace (o WFS e o resto), o endereço dos dados para o QGIS. */
  readonly urlOws: string;
  /**
   * Modelo de URL (`{z}/{y}/{x}`) dos tiles prontos de uma camada e estilo, no cache do
   * GeoServer (WMTS, EPSG:900913). `versao` muda a URL quando o mapa é republicado, então o
   * navegador pode guardar os tiles sem nunca mostrar um velho. Sem versão (a base em
   * atualização, ou nunca publicada), a URL vai sem `v=` e fica pouco tempo em cache. Com `cql`,
   * só as feições que atendem o filtro; o cache guarda cada filtro à parte.
   */
  urlTiles: (camada: string, estilo: string, versao: string | undefined, cql?: string) => string;
  readonly workspace: string;
  /** Nome qualificado (`workspace:camada`). */
  camada: (nome: string) => string;
  /** Linhas de uma tabela (só as propriedades). */
  linhas: <P>(tabela: string, opcoes?: OpcoesWfs) => Promise<P[]>;
  /**
   * Várias tabelas inteiras num pedido só (WFS 2.0, uma consulta por tabela), agrupadas por
   * nome: uma ida e volta em vez de uma por tabela.
   */
  tabelas: (
    nomes: readonly string[],
    opcoes?: { signal?: AbortSignal | undefined; versao?: string | undefined },
  ) => Promise<Record<string, unknown[]>>;
  /** Feições de uma camada, com geometria. */
  feicoes: <P>(camada: string, opcoes?: OpcoesWfs) => Promise<Feicao<P>[]>;
  /** Peças sob o clique, camada por camada (`GetFeatureInfo`). */
  identificar: <P>(
    camadas: readonly string[],
    consulta: ConsultaPonto,
    opcoes?: OpcoesIdentificacao,
  ) => Promise<FeicaoClicada<P>[]>;
  /** A versão dos dados (`fonte_vigente.versao_dados`) que vai nas consultas; sem ela, nada. */
  definirVersaoDosDados: (versao: string | undefined) => void;
  /** Link de download por WFS (`outputFormat`). */
  urlDownload: (
    tabela: string,
    formato: FormatoDownload,
    opcoes?: Pick<OpcoesWfs, "cql" | "propriedades">,
  ) => string;
};

export function createGeoServerApi(
  baseUrl: string,
  workspace: string,
  fetcher: typeof fetch = (...args) => fetch(...args),
): GeoServerApi {
  const raiz = baseUrl.replace(/\/+$/, "");
  const urlOws = `${raiz}/${workspace}/ows`;
  const urlWms = `${raiz}/${workspace}/wms`;
  const qualificar = (nome: string) => `${workspace}:${nome}`;
  let versaoDados: string | undefined;

  /** O WFS de uma tabela, em GeoJSON ou, num download, noutro formato. */
  function urlWfs(tabela: string, opcoes: OpcoesWfs, formato = "application/json"): string {
    const params = parametrosWfs(qualificar(tabela), opcoes);
    if (opcoes.semVersao !== true) comVersao(params, versaoDados);
    params.set("outputFormat", formato);
    return `${urlOws}?${params.toString()}`;
  }

  const ler = (url: string, signal?: AbortSignal) => lerGeoJson(fetcher, url, signal);

  return {
    urlWms,
    urlOws,
    workspace,
    camada: qualificar,
    urlTiles(camada, estilo, versao, cql) {
      // Nomes do catálogo (letras, dígitos, `_` e `:`): vão no caminho como estão.
      const v = versao === undefined ? "" : `&v=${encodeURIComponent(versao)}`;
      const filtro = temFiltro(cql) ? `&CQL_FILTER=${encodeURIComponent(cql)}` : "";
      return (
        `${raiz}/gwc/service/wmts/rest/${qualificar(camada)}/${qualificar(estilo)}` +
        `/EPSG:900913/EPSG:900913:{z}/{y}/{x}?format=image%2Fpng${v}${filtro}`
      );
    },
    async linhas<P>(tabela: string, opcoes: OpcoesWfs = {}) {
      return linhasDe<P>(await ler(urlWfs(tabela, opcoes), opcoes.signal));
    },
    async tabelas(nomes, opcoes = {}) {
      // O catálogo vai com a versão que lhe passam (a lida antes), não com a guardada.
      const params = comVersao(parametrosDasTabelas(nomes.map(qualificar)), opcoes.versao);
      return linhasPorTabela(nomes, await ler(`${urlOws}?${params.toString()}`, opcoes.signal));
    },
    async feicoes<P>(camada: string, opcoes: OpcoesWfs = {}) {
      return feicoesDe<P>(await ler(urlWfs(camada, opcoes), opcoes.signal));
    },
    async identificar<P>(
      camadas: readonly string[],
      consulta: ConsultaPonto,
      opcoes: OpcoesIdentificacao = {},
    ) {
      if (camadas.length === 0) return [];
      const params = parametrosDoClique(camadas.map(qualificar), consulta, opcoes);
      const url = `${urlWms}?${comVersao(params, versaoDados).toString()}`;
      return feicoesDoClique<P>(await ler(url, opcoes.signal));
    },
    definirVersaoDosDados(versao) {
      versaoDados = versao;
    },
    urlDownload(tabela, formato, opcoes = {}) {
      return urlWfs(tabela, opcoes, FORMATOS[formato]);
    },
  };
}
