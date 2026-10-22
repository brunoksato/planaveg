/**
 * Contrato do portal com o GeoServer do planaveg_core.
 *
 * Cada tipo abaixo é uma linha de uma tabela (ou camada) publicada no workspace `planaveg`.
 * Os nomes das propriedades são os nomes das colunas no PostGIS; quem os define é o
 * `categorias.v1.json` do planaveg_core. Mudou lá, muda aqui.
 */

/** Ano de vegetação secundária da base (`catalogo_ano`). */
export type CatalogoAno = {
  ano_vs: number;
  camada: string;
  rotulo: string;
};

/** Camada de mapa publicada (`catalogo_camada`), com extensão em EPSG:4674. */
export type CatalogoCamada = {
  ordem: number;
  camada: string;
  tipo: "peca" | "espacial" | "municipio";
  filtro: string | null;
  ano_vs: number | null;
  titulo: string;
  grupo: string | null;
  status: string | null;
  nota: string | null;
  cor: string | null;
  estilo: string;
  estilos_alternativos: string | null;
  n_feicoes: number;
  area_ha: number | null;
  minx: number | null;
  miny: number | null;
  maxx: number | null;
  maxy: number | null;
};

/** Linha da hierarquia do Anexo 1 (`catalogo_nivel`); níveis 9–11 têm uma por condição do CAR. */
export type CatalogoNivel = {
  tier: number;
  nivel: string;
  grupo: string;
  grupo_titulo: string;
  titulo: string;
  hierarquia: string | null;
  categoria: string | null;
  cor: string;
  presente: boolean;
  motivo_ausencia: string | null;
};

/** Arranjo de implementação do Anexo 2 (`catalogo_arranjo`), em ordem de prioridade. */
export type CatalogoArranjo = {
  prioridade: number;
  arranjo: string;
  titulo: string;
  criterio: string;
  cor: string;
  /** Meta de recuperação até `meta_ano` (Figura 4 do relatório técnico), em hectares. */
  meta_ha: number | null;
  meta_ano: number | null;
  /** Por que o arranjo fica com 0 ha: a base não traz o que a regra dele pede. */
  motivo_ausencia: string | null;
};

/** Filtro do relatório (`catalogo_filtro`). */
export type CatalogoFiltro = {
  ordem: number;
  filtro: string;
  grupo: string;
  titulo: string;
  subtitulo: string | null;
  tipo: "espacial" | "quantitativo" | "ambos";
  espacial: boolean;
  status: "presente" | "parcial" | "vazio";
  nota: string | null;
  cor: string;
  /** O filtro em CQL sobre as camadas de peças (o mesmo predicado do contrato). */
  cql: string;
  /**
   * Oferecido como tema nos filtros do mapa e do painel: espacial e sem repetir um caminho de
   * recuperação (o caminho já é uma lista).
   */
  tema: boolean;
};

/** Dimensão de recorte dos quantitativos (`catalogo_dimensao`). */
export type CatalogoDimensao = {
  ordem: number;
  dimensao: string;
  grupo: string;
  titulo: string;
};

/** O que o relatório pede e a base não traz (`fonte_ausente`). */
export type FonteAusente = {
  codigo: string;
  grupo: string;
  descricao: string;
};

/** O arquivo carregado (`fonte_vigente`). */
export type FonteVigente = {
  arquivo: string;
  sha256: string;
  tamanho_bytes: number;
  contrato: string;
  concluida_em: string;
  pecas: number | null;
  /** Muda quando muda a entrega, uma view desenhada ou um estilo; vai na URL dos tiles. */
  versao_mapa: string | null;
  /** A das consultas WFS: muda com qualquer view ou carga; vai na URL de cada uma. */
  versao_dados: string | null;
};

/** Hectares por ano e linha da hierarquia (`quantitativo_nivel`). */
export type QuantitativoNivel = {
  ano_vs: number;
  tier: number;
  nivel: string;
  grupo: string;
  hierarquia: string | null;
  categoria: string | null;
  titulo: string;
  presente: boolean;
  cor: string;
  n_pecas: number;
  area_ha: number;
  computo_recebido_ha: number | null;
  area_calculada_ha: number;
};

/** Hectares por ano e arranjo (`quantitativo_arranjo`); `nivel` null = total do arranjo. */
export type QuantitativoArranjo = {
  ano_vs: number;
  prioridade: number;
  arranjo: string;
  titulo: string;
  cor: string;
  nivel: string | null;
  n_pecas: number;
  area_ha: number;
};

/** Hectares por ano e filtro (`quantitativo_filtro`); `nivel` null = total do filtro. */
export type QuantitativoFiltro = {
  ano_vs: number;
  filtro: string;
  grupo: string;
  titulo: string;
  tipo: string;
  status: string;
  cor: string;
  nivel: string | null;
  n_pecas: number;
  area_ha: number;
};

/**
 * Peças, polígonos e hectares por ano e combinação de nível, condição do CAR, arranjo, UF, bioma e
 * filtros do relatório (`quantitativo_faceta`). Somar as linhas que atendem uma seleção dá os
 * totais de qualquer combinação: é a base das contagens dos filtros do mapa.
 */
export type QuantitativoFaceta = {
  ano_vs: number;
  nivel: string | null;
  categoria: string | null;
  arranjo: string | null;
  uf: string | null;
  bioma: string | null;
  /** Códigos dos filtros que as peças atendem, separados por vírgula ("" = nenhum). */
  temas: string;
  /** Esferas das Unidades de Conservação onde as peças estão: federal, estadual, municipal. */
  esferas_uc: string;
  /** Tipos dessas UCs: apa, rppn, outras ("" = fora de UC). */
  tipos_uc: string;
  n_pecas: number;
  /** Os polígonos dessas peças: cada peça junta os de mesmos atributos no município e na bacia. */
  n_poligonos: number;
  area_ha: number;
};

/**
 * As facetas de cada valor de dimensão (`quantitativo_faceta_lugar`): as colunas de
 * `QuantitativoFaceta` por lugar (UF, município, bacias, região hidrográfica, bioma). O nome
 * do lugar fica em `quantitativo_dimensao`.
 */
export type QuantitativoFacetaLugar = QuantitativoFaceta & {
  dimensao: string;
  chave: string | null;
};

/**
 * Hectares por ano e valor de dimensão (`quantitativo_dimensao`). `nivel` e `arranjo` null =
 * total do valor; um deles preenchido = recorte por nível ou por arranjo.
 */
export type QuantitativoDimensao = {
  ano_vs: number;
  dimensao: string;
  chave: string | null;
  rotulo: string | null;
  /** O rótulo como a busca pelo nome o compara (`termoDeBusca`), para `busca LIKE '%…%'`. */
  busca: string | null;
  nivel: string | null;
  arranjo: string | null;
  n_pecas: number;
  /** Os polígonos dessas peças, como os conta o mapa. */
  n_poligonos: number;
  area_ha: number;
};

/**
 * Atributos de uma peça devolvidos pelo clique no mapa (GetFeatureInfo). A peça junta todos os
 * polígonos com os mesmos atributos no município e na bacia, e `area_ha` é a soma deles.
 */
export type AtributosPeca = {
  fid: number;
  ano_vs: number;
  /** O fid da peça no GeoPackage, único no ano: com ele, `peca_parte` acha os polígonos dela. */
  origem_id: number;
  nivel: string | null;
  categoria: string | null;
  /**
   * A situação do cadastro no CAR com o nome da planilha de nomenclatura (só em APP, AUR e RL):
   * vai no CSV no lugar de `categoria`; o clique não a pede.
   */
  situacao_cadastro?: string | null;
  arranjo: string | null;
  hierarquia: string;
  area_ha: number;
  uf: string | null;
  municipio: string | null;
  bioma: string | null;
  bacia: string | null;
  sobreposicao: string | null;
  /** As fontes dos projetos de recuperação onde a peça está: as do Recooperar, o Observatório e
   * as de Projetos de Cooperação MMA. */
  licenciamento: boolean;
  reparacao_danos: boolean;
  embargo: boolean;
  outras_areas: boolean;
  observatorio: boolean;
  gef_terrestre: boolean;
  restauracao_ecologica: boolean;
  /** Em Unidade de Conservação federal, estadual ou municipal (inclui APA e RPPN). */
  uc_federal: boolean;
  uc_estadual: boolean;
  uc_municipal: boolean;
  /** Em APA, em RPPN ou em outra Unidade de Conservação. */
  apa: boolean;
  rppn: boolean;
  uc: boolean;
};

/**
 * Um polígono de uma peça (`peca_parte`), para o clique mostrar o polígono clicado e não só a
 * peça. O GeoServer só responde com a peça na URL (`viewparams` com `ano_vs` e `origem_id`).
 */
export type PartePeca = {
  fid_peca: number;
  ano_vs: number;
  origem_id: number;
  /** A posição do polígono na peça, de 1 a `partes`. */
  parte: number;
  /** Quantos polígonos a peça tem. */
  partes: number;
  /** Hectares do polígono, medidos na geometria da base (Albers), como os da peça. */
  area_ha: number;
};

/** Município com peças (`municipio`), para busca e zoom. */
export type MunicipioBusca = {
  cod_municipio: string;
  /** O nome; sem nome nas peças, o código. */
  municipio: string;
  /** A UF da maioria das peças; nula se nenhuma traz. */
  uf: string | null;
  rotulo: string;
  /** O rótulo como a busca pelo nome o compara (`termoDeBusca`), para `busca LIKE '%…%'`. */
  busca: string;
};

export class HttpError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(status: number, message = "Não foi possível concluir a operação.", code?: string) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    if (code !== undefined) this.code = code;
  }
}

export function shouldRetryQuery(failureCount: number, error: Error): boolean {
  if (failureCount >= 2) return false;
  if (error instanceof HttpError) return error.status >= 500 && error.status <= 599;
  return error instanceof TypeError;
}
