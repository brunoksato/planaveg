/**
 * Nomes e explicações para os códigos do catálogo. Os nomes dos grupos, das categorias e das
 * condições do CAR seguem a planilha de nomenclatura do SINAVEG (16/10/2026), a mesma do
 * relatório da metodologia; os dos arranjos, a revisão do MMA. O nome do relatório continua vindo
 * do GeoServer e aparece como nome secundário (tabela, dica) quando é outro; um código que não
 * está aqui, como os temas, usa o nome do relatório.
 */

export type Termo = {
  /** Nome curto, para gráfico, legenda e lista. */
  nome: string;
  /** Uma frase sobre o que entra ali. */
  descricao?: string;
  /** Onde a área está, para completar uma frase: "A maior parte está {local}." */
  local?: string;
};

/**
 * As duas categorias de saída do cômputo, como no relatório da metodologia: os projetos de
 * recuperação (a intencionalidade) e a vegetação secundária que a lei protege (a governança),
 * inclusive nas APP, AUR e RL dos imóveis do CAR.
 */
const CRITERIOS: Readonly<Record<Criterio, Termo>> = {
  intencionalidade: {
    nome: "Projetos de recuperação da vegetação nativa",
    descricao:
      "Áreas de projetos de recuperação, que entram inteiras, mesmo antes de a vegetação aparecer no mapeamento.",
    local: "em projetos de recuperação da vegetação nativa",
  },
  governanca: {
    nome: "Vegetação secundária em áreas legalmente protegidas",
    descricao:
      "Vegetação nativa que voltou a crescer em áreas que a lei protege: Terras Indígenas, Unidades de Conservação, manguezais e as APP, RL e AUR dos imóveis do CAR.",
    local: "em áreas legalmente protegidas",
  },
};

export type Criterio = "intencionalidade" | "governanca";

/** O critério de cada grupo da hierarquia (`catalogo_nivel.grupo`). */
const CRITERIO_DO_GRUPO: Readonly<Record<string, Criterio>> = {
  projetos: "intencionalidade",
  vs_protegida: "governanca",
};

/** Os critérios, na ordem da tabela. */
export const ORDEM_DOS_CRITERIOS: readonly Criterio[] = ["intencionalidade", "governanca"];

/** Níveis da hierarquia (`catalogo_nivel.nivel`), com o nome da planilha de nomenclatura. */
const NIVEIS: Readonly<Record<string, Termo>> = {
  recooperar: {
    nome: "Recooperar",
    descricao:
      "Áreas do Recooperar, do IBAMA: licenciamento (todas as áreas de LAC têm projeto), reparação de danos a partir do projeto protocolado e áreas embargadas em recuperação ou recuperadas. Inclui os projetos do Sistema ICMBio.",
  },
  monitorad: {
    nome: "MonitoRAD",
    descricao:
      "Áreas de embargos e de licenciamento com indícios de recuperação, pela análise de NDVI do IBAMA.",
  },
  sicar_regularizacao: {
    nome: "PRADA",
    descricao:
      "Área a recuperar dos imóveis do CAR analisados e em regularização ambiental, pelo Projeto de Recomposição de Áreas Degradadas e Alteradas (PRADA), na Reserva Legal, na APP e na Área de Uso Restrito.",
  },
  outros_projetos: {
    nome: "Projetos de Cooperação MMA",
    descricao:
      "Áreas de projetos de recuperação em cooperação com o MMA e com outros órgãos do governo, como o GEF Terrestre e a Restauração Ecológica.",
  },
  observatorio: {
    nome: "Observatório da Restauração e Recuperação",
    descricao:
      "Áreas de projetos de restauração registradas no formato público do Observatório da Restauração, a plataforma da sociedade civil.",
  },
  terra_indigena: {
    nome: "Terras Indígenas",
    descricao: "Terras Indígenas delimitadas, declaradas, homologadas e regularizadas.",
  },
  uc: {
    nome: "Unidades de Conservação",
    descricao:
      "Unidades de Conservação do CNUC, de proteção integral e de uso sustentável. Nas APAs, entram só as áreas públicas; as privadas seguem as regras dos imóveis rurais.",
  },
  manguezal: {
    nome: "Sistemas Costeiros",
    descricao:
      "Manguezais do mapeamento oficial do Pró-Manguezal (IBAMA) fora de Terras Indígenas e Unidades de Conservação. O manguezal é Área de Preservação Permanente em toda a extensão (Lei nº 12.651/2012, art. 4º, VII).",
  },
  app: {
    nome: "Área de Preservação Permanente (APP)",
    descricao:
      "Áreas de Preservação Permanente dos imóveis do CAR: margens de rios, nascentes, encostas íngremes e topos de morro.",
  },
  aur: {
    nome: "Área de Uso Restrito (AUR)",
    descricao:
      "Áreas de Uso Restrito dos imóveis do CAR, onde a lei limita o uso da terra, como pantanais e encostas inclinadas.",
  },
  rl: {
    nome: "Reserva Legal (RL)",
    descricao:
      "Reserva Legal dos imóveis do CAR: a parte de cada imóvel rural que deve manter vegetação nativa (de 20% a 80%, conforme a região).",
  },
};

/**
 * Arranjos de implementação (`catalogo_arranjo.arranjo`), com os nomes da revisão do MMA, os
 * mesmos do contrato, e as demais áreas de projetos, que não entram em nenhum arranjo.
 */
const ARRANJOS: Readonly<Record<string, Termo>> = {
  areas_publicas: {
    nome: "Recuperação da vegetação nativa em áreas públicas",
    descricao:
      "Terras Indígenas, Unidades de Conservação (nas APAs, só as áreas públicas), RPPNs, manguezais, assentamentos e territórios quilombolas.",
    local: "em áreas públicas",
  },
  app_rl_aur: {
    nome: "Recuperação da vegetação nativa em APP, RL e AUR",
    descricao:
      "Áreas de Preservação Permanente, Reserva Legal e Áreas de Uso Restrito dos imóveis rurais do CAR, e o PRADA.",
    local: "em APP, Reserva Legal e Áreas de Uso Restrito de imóveis rurais",
  },
  baixa_produtividade: {
    nome: "Recuperação da vegetação em áreas rurais consolidadas com sistemas integrados de produção",
    descricao:
      "Projetos com fins econômicos ou de restauração produtiva, como sistemas agroflorestais, integração lavoura-pecuária-floresta e silvicultura de nativas.",
    local: "em áreas rurais consolidadas com sistemas integrados de produção",
  },
  demais_areas: {
    nome: "Demais áreas de projetos",
    descricao:
      "Áreas de projetos de recuperação que não entram em nenhum dos arranjos. Não têm meta própria.",
    local: "em demais áreas de projetos",
  },
};

/** Os processos que dão origem aos projetos de recuperação (Anexo 2 do relatório). */
const PROCESSOS: Readonly<Record<string, Termo>> = {
  embargo: {
    nome: "Embargos",
    descricao: "Áreas embargadas pelo IBAMA em recuperação ou recuperadas (Recooperar).",
    local: "em áreas embargadas pelo IBAMA",
  },
  reparacao: {
    nome: "Reparação de danos",
    descricao: "Áreas que devem ser recuperadas para reparar danos ambientais (Recooperar).",
    local: "em reparação de danos ambientais",
  },
  licenciamento: {
    nome: "Licenciamento ambiental",
    descricao: "Plantio compensatório exigido no licenciamento ambiental (Recooperar).",
    local: "em compensações do licenciamento ambiental",
  },
  outros: {
    nome: "Outros projetos",
    descricao:
      "PRADA, Projetos de Cooperação MMA, Observatório da Restauração e Recuperação, demandas judiciais e outros projetos.",
    local: "em outros projetos",
  },
};

/** Esferas das Unidades de Conservação (`esferas_uc`), com as áreas em mais de uma e sem esfera. */
const ESFERAS_UC: Readonly<Record<string, string>> = {
  federal: "Federais",
  estadual: "Estaduais",
  municipal: "Municipais",
  mais_de_uma: "Mais de uma esfera",
  sem_esfera: "Esfera não informada",
};

/** Tipos das Unidades de Conservação (`tipos_uc`), com as áreas em mais de um tipo. */
const TIPOS_UC: Readonly<Record<string, string>> = {
  apa: "Áreas de Proteção Ambiental (APA)",
  rppn: "Reservas Particulares do Patrimônio Natural (RPPN)",
  outras: "Demais Unidades de Conservação",
  mais_de_uma: "Mais de um tipo",
};

/** Grupos dos filtros, que vêm do GeoServer pelo título. */
const GRUPOS_DE_FILTRO: Readonly<Record<string, string>> = {
  "Projetos de Recuperação da Vegetação Nativa": "Projetos de recuperação da vegetação nativa",
  "Vegetação Secundária em Áreas Legalmente Protegidas":
    "Vegetação secundária em áreas legalmente protegidas",
  "Arranjos de Implementação do Planaveg": "Arranjos de implementação",
  "Limites Ecológicos provenientes de dados oficiais": "Ecossistemas",
  "Categorias Fundiárias": "Situação da terra",
};

/**
 * As duas condições do cadastro no CAR da planilha de nomenclatura, com as condições que a base
 * traz em cada uma (`categoria` dos níveis de APP, AUR e RL).
 */
const CONDICOES_CAR = {
  em_conformidade: {
    nome: "Analisado em conformidade",
    descricao:
      "Cadastro analisado, em conformidade com a Lei nº 12.651/2012, com ativos e em regularização.",
    categorias: ["Habilitados"],
  },
  nao_analisado: {
    nome: "Não analisado ou em análise",
    descricao: "Cadastro não analisado, em análise ou aguardando retificação.",
    categorias: ["Analisados", "Nao_Analisados"],
  },
} as const satisfies Record<string, Termo & { categorias: readonly string[] }>;

export type CondicaoCar = keyof typeof CONDICOES_CAR;

/** As condições do cadastro, na ordem da planilha. */
export const CONDICOES_DO_CADASTRO: readonly CondicaoCar[] = ["em_conformidade", "nao_analisado"];

/** Fundos do mapa, pelo que se vê (o provedor fica na atribuição do mapa). */
const MAPAS_BASE: Readonly<Record<string, string>> = {
  claro: "Claro",
  ruas: "Ruas",
  satelite: "Satélite",
};

export type NomeDimensao = {
  singular: string;
  plural: string;
  /** "um" ou "uma": "Escolha um estado", "Escolha uma bacia hidrográfica". */
  artigo: "um" | "uma";
};

const DIMENSOES: Readonly<Record<string, NomeDimensao>> = {
  uf: { singular: "estado", plural: "estados", artigo: "um" },
  municipio: { singular: "município", plural: "municípios", artigo: "um" },
  bacia: { singular: "bacia hidrográfica", plural: "bacias hidrográficas", artigo: "uma" },
  bacia_meso: {
    singular: "mesobacia hidrográfica",
    plural: "mesobacias hidrográficas",
    artigo: "uma",
  },
  regiao_hidrografica: {
    singular: "região hidrográfica",
    plural: "regiões hidrográficas",
    artigo: "uma",
  },
  bioma: { singular: "bioma", plural: "biomas", artigo: "um" },
};

const ESTADOS: Readonly<Record<string, string>> = {
  AC: "Acre",
  AL: "Alagoas",
  AM: "Amazonas",
  AP: "Amapá",
  BA: "Bahia",
  CE: "Ceará",
  DF: "Distrito Federal",
  ES: "Espírito Santo",
  GO: "Goiás",
  MA: "Maranhão",
  MG: "Minas Gerais",
  MS: "Mato Grosso do Sul",
  MT: "Mato Grosso",
  PA: "Pará",
  PB: "Paraíba",
  PE: "Pernambuco",
  PI: "Piauí",
  PR: "Paraná",
  RJ: "Rio de Janeiro",
  RN: "Rio Grande do Norte",
  RO: "Rondônia",
  RR: "Roraima",
  RS: "Rio Grande do Sul",
  SC: "Santa Catarina",
  SE: "Sergipe",
  SP: "São Paulo",
  TO: "Tocantins",
};

/** Valor do recorte para peças fora dos limites oficiais (no mar, por exemplo): `FORA`, `(FORA)`. */
const FORA = /^\(?FORA\)?$/;

/** Peças fora dos limites oficiais (no mar, por exemplo) trazem `FORA` no recorte. */
export function foraDosLimites(valor: string): boolean {
  return FORA.test(valor.trim());
}

/** O critério de um grupo da hierarquia; um grupo novo fica na governança, com a vegetação protegida. */
export function criterioDoGrupo(grupo: string): Criterio {
  return CRITERIO_DO_GRUPO[grupo] ?? "governanca";
}

export function termoCriterio(criterio: Criterio): Termo {
  return CRITERIOS[criterio];
}

export function termoNivel(codigo: string, oficial: string): Termo {
  return NIVEIS[codigo] ?? { nome: oficial };
}

export function termoArranjo(codigo: string, oficial: string): Termo {
  return ARRANJOS[codigo] ?? { nome: oficial };
}

export function nomeEsferaUc(codigo: string): string {
  return ESFERAS_UC[codigo] ?? codigo;
}

export function nomeTipoUc(codigo: string): string {
  return TIPOS_UC[codigo] ?? codigo;
}

export function termoProcesso(codigo: string): Termo {
  return PROCESSOS[codigo] ?? { nome: codigo };
}

export function nomeGrupoDeFiltro(oficial: string): string {
  return GRUPOS_DE_FILTRO[oficial] ?? oficial;
}

export function nomeMapaBase(chave: string, oficial: string): string {
  return MAPAS_BASE[chave] ?? oficial;
}

/** A condição do cadastro de uma `categoria` da base: `Nao_Analisados` → `nao_analisado`. */
export function condicaoDaCategoria(categoria: string): CondicaoCar | undefined {
  return CONDICOES_DO_CADASTRO.find((c) =>
    (CONDICOES_CAR[c].categorias as readonly string[]).includes(categoria),
  );
}

/** As `categoria` da base numa condição do cadastro. */
export function categoriasDaCondicao(condicao: string): readonly string[] {
  return condicao in CONDICOES_CAR ? CONDICOES_CAR[condicao as CondicaoCar].categorias : [];
}

export function termoCondicaoCar(condicao: CondicaoCar): Termo {
  return CONDICOES_CAR[condicao];
}

/** O nome da condição de um código de condição ou de uma `categoria` da base. */
export function nomeCondicaoCar(codigo: string): string {
  const condicao = codigo in CONDICOES_CAR ? (codigo as CondicaoCar) : condicaoDaCategoria(codigo);
  return condicao === undefined ? codigo.replaceAll("_", " ") : CONDICOES_CAR[condicao].nome;
}

export function nomeDimensao(codigo: string, oficial: string): NomeDimensao {
  const minusculo = oficial.toLocaleLowerCase("pt-BR");
  return DIMENSOES[codigo] ?? { singular: minusculo, plural: minusculo, artigo: "um" };
}

/** As palavras que concordam com o gênero de uma dimensão nos textos do painel. */
type PalavrasDoGenero = {
  os: string;
  todos: string;
  num: string;
  dele: string;
  outro: string;
  outros: string;
  primeiros: string;
};

const MASCULINO: PalavrasDoGenero = {
  os: "os",
  todos: "todos",
  num: "num",
  dele: "dele",
  outro: "outro",
  outros: "outros",
  primeiros: "primeiros",
};

const FEMININO: PalavrasDoGenero = {
  os: "as",
  todos: "todas",
  num: "numa",
  dele: "dela",
  outro: "outra",
  outros: "outras",
  primeiros: "primeiras",
};

/** "os estados" e "num estado", mas "as bacias" e "numa bacia": o gênero vem do artigo. */
export function palavrasDoGenero(nomes: NomeDimensao): PalavrasDoGenero {
  return nomes.artigo === "uma" ? FEMININO : MASCULINO;
}

/** O plural com o artigo do gênero da dimensão: "os estados", "as bacias hidrográficas". */
export function osPlural(nomes: NomeDimensao): string {
  return `${palavrasDoGenero(nomes).os} ${nomes.plural}`;
}

/** "todos os estados", "todas as bacias hidrográficas". */
export function todosOsPlural(nomes: NomeDimensao): string {
  return `${palavrasDoGenero(nomes).todos} ${osPlural(nomes)}`;
}

/**
 * Os três níveis das bacias, do maior ao menor: cada região hidrográfica tem mesobacias, e cada
 * mesobacia tem bacias. O nome curto é o da troca de nível no cartão das bacias.
 */
export const NIVEIS_DE_BACIA = [
  { dimensao: "regiao_hidrografica", nome: "Região hidrográfica" },
  { dimensao: "bacia_meso", nome: "Mesobacia" },
  { dimensao: "bacia", nome: "Bacia" },
] as const;

/** A bacia leva a mesobacia entre parênteses, quando ela tem outro nome (o arquivo repete nomes). */
export const NOTA_DO_NOME_DA_BACIA =
  "Entre parênteses, a mesobacia de cada bacia, quando ela tem outro nome.";

/**
 * Nome de um valor do recorte para leitura: a sigla da UF vira o nome do estado e nomes em
 * caixa alta ("ATLÂNTICO NORDESTE OCIDENTAL") ficam só com as iniciais maiúsculas.
 */
export function nomeLugar(dimensao: string, chave: string | null, rotulo: string | null): string {
  const texto = (rotulo ?? chave ?? "").trim();
  if (texto === "" || FORA.test(texto)) return "Fora dos limites oficiais";
  if (dimensao === "uf") return ESTADOS[texto] ?? texto;
  return texto === texto.toLocaleUpperCase("pt-BR") ? iniciaisMaiusculas(texto) : texto;
}

const MINUSCULAS = new Set(["da", "das", "de", "do", "dos", "e"]);

/**
 * "ATLÂNTICO NORDESTE OCIDENTAL" → "Atlântico Nordeste Ocidental"; "da", "de", "e"… ficam em
 * minúsculas, menos no começo.
 */
function iniciaisMaiusculas(texto: string): string {
  return texto
    .toLocaleLowerCase("pt-BR")
    .split(" ")
    .map((palavra, indice) =>
      indice > 0 && MINUSCULAS.has(palavra) ? palavra : comInicialMaiuscula(palavra),
    )
    .join(" ");
}

/** A inicial maiúscula, também depois de hífen: "tocantins-araguaia" → "Tocantins-Araguaia". */
function comInicialMaiuscula(palavra: string): string {
  return palavra.replace(
    /(^|-)(\p{L})/gu,
    (_, antes: string, letra: string) => `${antes}${letra.toLocaleUpperCase("pt-BR")}`,
  );
}

/** O nome simples é o do relatório, talvez com a sigla: "Reserva Legal (RL)". */
export function mesmoNome(nome: string, oficial: string): boolean {
  return nome === oficial || nome.replace(/ \([^()]+\)$/u, "") === oficial;
}

/** "Nome no relatório: …", quando o nome simples é outro. */
export function nomeOficial(termo: Termo, oficial: string): string | undefined {
  return mesmoNome(termo.nome, oficial) ? undefined : `Nome no relatório: ${oficial}`;
}
