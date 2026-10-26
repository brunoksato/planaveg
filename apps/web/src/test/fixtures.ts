import type {
  AtributosPeca,
  CatalogoAno,
  CatalogoArranjo,
  CatalogoCamada,
  CatalogoDimensao,
  CatalogoFiltro,
  CatalogoNivel,
  FonteAusente,
  FonteVigente,
  PartePeca,
  QuantitativoArranjo,
  QuantitativoDimensao,
  QuantitativoFaceta,
  QuantitativoFacetaLugar,
  QuantitativoFiltro,
  QuantitativoNivel,
} from "@sinaveg/web-contracts";

/** Recorte pequeno do que o GeoServer do planaveg_core publica, com números reais. */

/**
 * O rótulo como o core o grava em `busca` (`_busca`, em `publicacao/comum.py`), a mesma regra do
 * `termoDeBusca`: sem acento, em minúsculas, só letras, dígitos, espaço, hífen e apóstrofo (o
 * curvo vira o reto), sem espaço repetido. "Bonito (MS)" fica "bonito ms".
 */
export function buscaDe(rotulo: string): string {
  return rotulo
    .normalize("NFD")
    .replaceAll(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("pt-BR")
    .replaceAll(/[‘’]/g, "'")
    .replaceAll(/[^a-z0-9 '-]/g, "")
    .replaceAll(/ {2,}/g, " ")
    .trim();
}

export const ANOS: CatalogoAno[] = [
  { ano_vs: 2022, camada: "Planaveg_2026_Visualizacao_vs22q", rotulo: "VS 2022" },
  { ano_vs: 2024, camada: "Planaveg_2026_Visualizacao_vs2224q", rotulo: "VS 2024" },
];

function nivel(
  tier: number,
  codigo: string,
  grupo: string,
  grupoTitulo: string,
  titulo: string,
  cor: string,
  categoria: string | null = null,
  presente = true,
): CatalogoNivel {
  return {
    tier,
    nivel: codigo,
    grupo,
    grupo_titulo: grupoTitulo,
    titulo,
    hierarquia: presente ? `${titulo}${categoria === null ? "" : ` - ${categoria}`}` : null,
    categoria,
    cor,
    presente,
    motivo_ausencia: presente ? null : "O arquivo não traz peças de tier 2.",
  };
}

const PROJETOS = "Projetos de Recuperação da Vegetação Nativa";
const PROTEGIDA = "Vegetação Secundária em Áreas Legalmente Protegidas";

export const NIVEIS: CatalogoNivel[] = [
  nivel(1, "recooperar", "projetos", PROJETOS, "Recooperar", "#7f2704"),
  nivel(2, "monitorad", "projetos", PROJETOS, "MonitoRAD", "#fdae6b", null, false),
  nivel(7, "uc", "vs_protegida", PROTEGIDA, "Unidades de Conservação", "#31a354"),
  nivel(
    9,
    "app",
    "vs_protegida",
    PROTEGIDA,
    "Área de Preservação Permanente",
    "#08519c",
    "Habilitados",
  ),
  nivel(
    9,
    "app",
    "vs_protegida",
    PROTEGIDA,
    "Área de Preservação Permanente",
    "#08519c",
    "Analisados",
  ),
  nivel(
    9,
    "app",
    "vs_protegida",
    PROTEGIDA,
    "Área de Preservação Permanente",
    "#08519c",
    "Nao_Analisados",
  ),
  nivel(11, "rl", "vs_protegida", PROTEGIDA, "Reserva Legal", "#6baed6", "Habilitados"),
];

export const ARRANJOS: CatalogoArranjo[] = [
  {
    prioridade: 1,
    arranjo: "areas_publicas",
    titulo: "Recuperação da vegetação nativa em áreas públicas",
    criterio: "UCs, TIs, assentamentos e quilombos.",
    cor: "#7fbc41",
    meta_ha: 2_000_000,
    meta_ano: 2030,
    motivo_ausencia: null,
  },
  {
    prioridade: 2,
    arranjo: "app_rl_aur",
    titulo: "Recuperação da vegetação nativa em APP, RL e AUR",
    criterio: "Implementação da LPVN em imóveis rurais.",
    cor: "#2166ac",
    meta_ha: 9_000_000,
    meta_ano: 2030,
    motivo_ausencia: null,
  },
  {
    prioridade: 3,
    arranjo: "baixa_produtividade",
    titulo:
      "Recuperação da vegetação em áreas rurais consolidadas com sistemas integrados de produção",
    criterio: "Projetos com fins econômicos.",
    cor: "#e08214",
    meta_ha: 1_000_000,
    meta_ano: 2030,
    motivo_ausencia: "Fica zerado por enquanto: a base não traz as técnicas.",
  },
  {
    prioridade: 4,
    arranjo: "demais_areas",
    titulo: "Demais áreas de projetos",
    criterio: "O que sobra dos arranjos.",
    cor: "#9e9e9e",
    meta_ha: null,
    meta_ano: null,
    motivo_ausencia: null,
  },
];

export const FILTROS: CatalogoFiltro[] = [
  {
    ordem: 1,
    filtro: "embargo_recooperar",
    grupo: PROJETOS,
    titulo: "Áreas em recuperação por processos de Embargo (Recooperar)",
    subtitulo: "Áreas sob sanções administrativas aplicadas pelo IBAMA",
    tipo: "ambos",
    espacial: true,
    status: "presente",
    nota: null,
    cor: "#b2182b",
    cql: "(embargo = true)",
    tema: true,
  },
  {
    ordem: 2,
    filtro: "unidade_conservacao",
    grupo: PROTEGIDA,
    titulo: "Unidades de Conservação",
    subtitulo: "Nome, Esfera, Grupo e Categoria de Manejo",
    tipo: "ambos",
    espacial: true,
    status: "parcial",
    nota: "Só a esfera e o tipo vêm no arquivo.",
    cor: "#1b7837",
    cql: "(uc = true OR apa = true OR rppn = true)",
    tema: true,
  },
  {
    ordem: 3,
    filtro: "fundiario_uc",
    grupo: "Categorias Fundiárias",
    titulo: "Unidades de Conservação (fundiário)",
    subtitulo: null,
    tipo: "quantitativo",
    espacial: false,
    status: "presente",
    nota: null,
    cor: "#1b7837",
    cql: "(uc = true OR apa = true OR rppn = true)",
    tema: false,
  },
];

export const DIMENSOES: CatalogoDimensao[] = [
  { ordem: 1, dimensao: "uf", grupo: "Limites Administrativos", titulo: "Estado" },
  { ordem: 2, dimensao: "municipio", grupo: "Limites Administrativos", titulo: "Município" },
];

/** Quatro das fontes do contrato, na ordem dele: o grupo das malhas reaparece depois de outro. */
export const AUSENTES: FonteAusente[] = [
  {
    codigo: "monitorad",
    grupo: "Cômputo Planaveg",
    descricao: "Nível 2 (MonitoRAD) sem peças no arquivo.",
  },
  {
    codigo: "areas_prioritarias_conservacao",
    grupo: "Limites Administrativos",
    descricao: "Áreas prioritárias para conservação: sem atributo nem malha.",
  },
  {
    codigo: "fitofisionomias",
    grupo: "Limites Ecológicos provenientes de dados oficiais",
    descricao: "Fitofisionomias IBGE: sem atributo nem malha.",
  },
  {
    codigo: "malhas_territoriais",
    grupo: "Limites Administrativos",
    descricao:
      "Polígonos de UF, município, bacia e bioma: o arquivo traz só o atributo da peça, não a malha.",
  },
];

export const FONTE: FonteVigente = {
  arquivo: "Planaveg_2026_Categorias_Visualizacao.gpkg",
  sha256: "5600113cf14f5ee8038fce4e3f75a1e1d0f2809b9a46ea6267375a22ebd3f195",
  tamanho_bytes: 7_598_690_304,
  contrato: "1.0.0",
  concluida_em: "2026-10-05T23:10:39Z",
  pecas: 162_196,
  versao_mapa: "19d69549e25bb122",
  versao_dados: "8f1c2a7b3d4e5f60",
};

function camada(
  ordem: number,
  nome: string,
  tipo: CatalogoCamada["tipo"],
  ano: number | null,
  filtro: string | null,
  titulo: string,
  nFeicoes: number,
  areaHa: number | null,
): CatalogoCamada {
  return {
    ordem,
    camada: nome,
    tipo,
    filtro,
    ano_vs: ano,
    titulo,
    grupo: null,
    status: null,
    nota: null,
    cor: null,
    estilo:
      tipo === "espacial"
        ? `planaveg_filtro_${filtro ?? ""}`
        : tipo === "municipio"
          ? "planaveg_municipio"
          : "planaveg_nivel",
    estilos_alternativos: tipo === "peca" ? "planaveg_arranjo" : null,
    n_feicoes: nFeicoes,
    area_ha: areaHa,
    minx: -74,
    miny: -34,
    maxx: -28.6,
    maxy: 5.4,
  };
}

export const CAMADAS: CatalogoCamada[] = [
  camada(1, "peca", "peca", null, null, "Peças Planaveg (todos os anos)", 162_196, 17_391_848.7),
  camada(2, "peca_2022", "peca", 2022, null, "Peças Planaveg VS 2022", 81_264, 8_588_736.0),
  camada(3, "peca_2024", "peca", 2024, null, "Peças Planaveg VS 2024", 80_932, 8_803_112.7),
  camada(
    4,
    "espacial_embargo_recooperar_2024",
    "espacial",
    2024,
    "embargo_recooperar",
    "Áreas em recuperação por processos de Embargo (Recooperar) — VS 2024",
    466,
    15_197.4,
  ),
  camada(
    5,
    "espacial_unidade_conservacao_2024",
    "espacial",
    2024,
    "unidade_conservacao",
    "Unidades de Conservação — VS 2024",
    13_441,
    1_742_683.1,
  ),
  camada(6, "municipio", "municipio", null, null, "Municípios com peças", 5_258, null),
];

function linhaNivel(
  ano: number,
  tier: number,
  codigo: string,
  grupo: string,
  titulo: string,
  areaHa: number,
  categoria: string | null = null,
): QuantitativoNivel {
  return {
    ano_vs: ano,
    tier,
    nivel: codigo,
    grupo,
    hierarquia: titulo,
    categoria,
    titulo,
    presente: true,
    cor: "#000000",
    n_pecas: 100,
    area_ha: areaHa,
    computo_recebido_ha: areaHa,
    area_calculada_ha: areaHa,
  };
}

export const QUANTITATIVO_NIVEL: QuantitativoNivel[] = [
  linhaNivel(2022, 1, "recooperar", "projetos", "Recooperar", 107_092.9),
  linhaNivel(2022, 7, "uc", "vs_protegida", "Unidades de Conservação", 1_337_569.8),
  linhaNivel(
    2022,
    9,
    "app",
    "vs_protegida",
    "Área de Preservação Permanente",
    1_221_106.0,
    "Habilitados",
  ),
  linhaNivel(2022, 11, "rl", "vs_protegida", "Reserva Legal", 4_331_236.8, "Habilitados"),
  linhaNivel(2024, 1, "recooperar", "projetos", "Recooperar", 107_092.9),
  linhaNivel(2024, 7, "uc", "vs_protegida", "Unidades de Conservação", 1_340_832.3),
  linhaNivel(
    2024,
    9,
    "app",
    "vs_protegida",
    "Área de Preservação Permanente",
    350_521.3,
    "Habilitados",
  ),
  linhaNivel(
    2024,
    9,
    "app",
    "vs_protegida",
    "Área de Preservação Permanente",
    142_856.8,
    "Analisados",
  ),
  linhaNivel(
    2024,
    9,
    "app",
    "vs_protegida",
    "Área de Preservação Permanente",
    748_169.1,
    "Nao_Analisados",
  ),
  linhaNivel(2024, 11, "rl", "vs_protegida", "Reserva Legal", 4_489_443.3, "Habilitados"),
];

export const QUANTITATIVO_ARRANJO: QuantitativoArranjo[] = ARRANJOS.flatMap((a, i) =>
  [2022, 2024].map((ano) => ({
    ano_vs: ano,
    prioridade: a.prioridade,
    arranjo: a.arranjo,
    titulo: a.titulo,
    cor: a.cor,
    nivel: null,
    n_pecas: 10,
    area_ha: [1_337_569.8, 5_552_342.8, 0, 107_092.9][i] ?? 0,
  })),
);

export const QUANTITATIVO_FILTRO: QuantitativoFiltro[] = [
  {
    ano_vs: 2024,
    filtro: "embargo_recooperar",
    grupo: PROJETOS,
    titulo: "Embargo (Recooperar)",
    tipo: "ambos",
    status: "presente",
    cor: "#b2182b",
    nivel: null,
    n_pecas: 466,
    area_ha: 15_197.4,
  },
  {
    ano_vs: 2024,
    filtro: "unidade_conservacao",
    grupo: PROTEGIDA,
    titulo: "Unidades de Conservação",
    tipo: "ambos",
    status: "parcial",
    cor: "#1b7837",
    nivel: null,
    n_pecas: 13_441,
    area_ha: 1_742_683.1,
  },
];

export const PECA_CLICADA: AtributosPeca = {
  fid: 2_024_000_011_980,
  ano_vs: 2024,
  origem_id: 11_980,
  nivel: "app",
  categoria: "Habilitados",
  arranjo: "app_rl_aur",
  hierarquia: "VS em APP (SICAR) - Habilitados",
  area_ha: 11.7366,
  uf: "GO",
  municipio: "São Domingos",
  bioma: "Cerrado",
  bacia: "Paranã",
  sobreposicao: "CARAS",
  licenciamento: false,
  reparacao_danos: false,
  embargo: false,
  outras_areas: false,
  observatorio: false,
  gef_terrestre: false,
  restauracao_ecologica: false,
  uc_federal: false,
  uc_estadual: false,
  uc_municipal: false,
  apa: false,
  rppn: false,
  uc: false,
};

/** O polígono clicado da `PECA_CLICADA` (`peca_parte`): um dos 24 que a peça junta. */
export const PARTE_CLICADA: PartePeca = {
  fid_peca: PECA_CLICADA.fid,
  ano_vs: 2024,
  origem_id: PECA_CLICADA.origem_id,
  parte: 7,
  partes: 24,
  area_ha: 2.4189,
};

function faceta(
  ano: number,
  nivelCodigo: string,
  categoria: string | null,
  arranjo: string,
  uf: string,
  bioma: string,
  temas: string,
  areaHa: number,
  /** Esferas e tipos das UCs onde a área está ("" = fora de UC). */
  uc: { esferas: string; tipos: string } = { esferas: "", tipos: "" },
): QuantitativoFaceta {
  return {
    ano_vs: ano,
    nivel: nivelCodigo,
    categoria,
    arranjo,
    uf,
    bioma,
    temas,
    esferas_uc: uc.esferas,
    tipos_uc: uc.tipos,
    n_pecas: 100,
    // Cada peça junta vários polígonos de mesmos atributos (na base, 59 por peça em média).
    n_poligonos: 300,
    area_ha: areaHa,
  };
}

/** UC federal, que não é APA nem RPPN; e uma APA estadual. */
const UC_FEDERAL = { esferas: "federal", tipos: "outras" };
const APA_ESTADUAL = { esferas: "estadual", tipos: "apa" };

/** As mesmas áreas de `QUANTITATIVO_NIVEL`, abertas por estado, bioma e temas. */
export const QUANTITATIVO_FACETA: QuantitativoFaceta[] = [
  faceta(
    2022,
    "recooperar",
    null,
    "demais_areas",
    "PA",
    "Amazônia",
    "embargo_recooperar",
    107_092.9,
  ),
  faceta(
    2022,
    "uc",
    null,
    "areas_publicas",
    "MT",
    "Amazônia",
    "unidade_conservacao,fundiario_uc",
    1_337_569.8,
    UC_FEDERAL,
  ),
  faceta(2022, "app", "Habilitados", "app_rl_aur", "MT", "Cerrado", "", 1_221_106.0),
  faceta(2022, "rl", "Habilitados", "app_rl_aur", "MT", "Amazônia", "", 4_331_236.8),
  faceta(
    2024,
    "recooperar",
    null,
    "demais_areas",
    "PA",
    "Amazônia",
    "embargo_recooperar",
    107_092.9,
  ),
  faceta(
    2024,
    "uc",
    null,
    "areas_publicas",
    "MT",
    "Amazônia",
    "unidade_conservacao,fundiario_uc",
    1_000_000.0,
    UC_FEDERAL,
  ),
  faceta(
    2024,
    "uc",
    null,
    "areas_publicas",
    "PA",
    "Cerrado",
    "unidade_conservacao,fundiario_uc",
    340_832.3,
    APA_ESTADUAL,
  ),
  faceta(2024, "app", "Habilitados", "app_rl_aur", "MT", "Cerrado", "", 350_521.3),
  faceta(
    2024,
    "app",
    "Analisados",
    "app_rl_aur",
    "PA",
    "Amazônia",
    "embargo_recooperar",
    142_856.8,
  ),
  faceta(2024, "app", "Nao_Analisados", "app_rl_aur", "MT", "Amazônia", "", 748_169.1),
  faceta(2024, "rl", "Habilitados", "app_rl_aur", "MT", "Amazônia", "", 4_489_443.3),
];

/** Um município do Pará com parte das áreas do estado: embargos nos dois anos e APP em 2024. */
const ALTAMIRA: QuantitativoFacetaLugar[] = [
  {
    ...faceta(
      2022,
      "recooperar",
      null,
      "demais_areas",
      "PA",
      "Amazônia",
      "embargo_recooperar",
      45_000,
    ),
    n_pecas: 35,
    dimensao: "municipio",
    chave: "1500602",
  },
  {
    ...faceta(
      2024,
      "recooperar",
      null,
      "demais_areas",
      "PA",
      "Amazônia",
      "embargo_recooperar",
      50_000,
    ),
    n_pecas: 40,
    dimensao: "municipio",
    chave: "1500602",
  },
  {
    ...faceta(
      2024,
      "app",
      "Analisados",
      "app_rl_aur",
      "PA",
      "Amazônia",
      "embargo_recooperar",
      40_000,
    ),
    n_pecas: 30,
    dimensao: "municipio",
    chave: "1500602",
  },
];

/**
 * As facetas de cada lugar: as do Brasil abertas por estado e por bioma (cada combinação já é
 * única dentro de um lugar) e um município.
 */
export const QUANTITATIVO_FACETA_LUGAR: QuantitativoFacetaLugar[] = [
  ...QUANTITATIVO_FACETA.flatMap((linha) => [
    { ...linha, dimensao: "uf", chave: linha.uf },
    { ...linha, dimensao: "bioma", chave: linha.bioma },
  ]),
  ...ALTAMIRA,
];

const ROTULOS: Readonly<Record<string, string>> = { "1500602": "Altamira (PA)" };

/**
 * Os totais de cada lugar (e por nível e por arranjo) somados das facetas dele: as duas tabelas
 * batem, como o `verify` confere no banco.
 */
export const QUANTITATIVO_DIMENSAO: QuantitativoDimensao[] = (() => {
  const grupos = new Map<string, QuantitativoDimensao>();
  const somar = (
    linha: QuantitativoFacetaLugar,
    nivelCodigo: string | null,
    arranjo: string | null,
  ) => {
    const chave = [linha.ano_vs, linha.dimensao, linha.chave, nivelCodigo, arranjo].join("|");
    const rotulo = ROTULOS[linha.chave ?? ""] ?? linha.chave;
    const grupo = grupos.get(chave) ?? {
      ano_vs: linha.ano_vs,
      dimensao: linha.dimensao,
      chave: linha.chave,
      rotulo,
      busca: rotulo === null ? null : buscaDe(rotulo),
      nivel: nivelCodigo,
      arranjo,
      n_pecas: 0,
      n_poligonos: 0,
      area_ha: 0,
    };
    grupo.n_pecas += linha.n_pecas;
    grupo.n_poligonos += linha.n_poligonos;
    grupo.area_ha += linha.area_ha;
    grupos.set(chave, grupo);
  };
  for (const linha of QUANTITATIVO_FACETA_LUGAR) {
    somar(linha, null, null);
    somar(linha, linha.nivel, null);
    somar(linha, null, linha.arranjo);
  }
  return [...grupos.values()];
})();
