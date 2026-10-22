const HECTARES = new Intl.NumberFormat("pt-BR", {
  maximumFractionDigits: 1,
  minimumFractionDigits: 1,
});
const INTEIRO = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });
const PERCENTUAL = new Intl.NumberFormat("pt-BR", { style: "percent", maximumFractionDigits: 1 });

/**
 * O começo do que existe e arredonda para zero (`menos de 0,1 ha`, `menos de 0,1%`). Os
 * indicadores do painel (`Numero`) o reconhecem para desenhar o número grande, e não o "menos".
 */
export const MENOS_DE = "menos de ";

/** Uma área que existe e arredonda para zero: nunca `0 ha` nem `0,0 ha` para algo que está lá. */
const MENOS_DE_UM_DECIMO = `${MENOS_DE}0,1 ha`;

/** A área existe, mas arredonda para zero com uma casa. */
function lasca(valor: number): boolean {
  return valor > 0 && valor < 0.05;
}

/** A área de uma área mapeada: `11,7 ha`; abaixo de 0,1 ha, `menos de 0,1 ha`; zero, `0 ha`. */
export function formatarAreaMapeada(valor: number): string {
  if (valor === 0) return "0 ha";
  if (lasca(valor)) return MENOS_DE_UM_DECIMO;
  return `${HECTARES.format(valor)} ha`;
}

export function formatarInteiro(valor: number): string {
  return INTEIRO.format(valor);
}

/** Uma contagem exata, para tabelas e dicas: `1 polígono`, `4.812.345 polígonos`. */
export function formatarContagem(valor: number, singular: string, plural: string): string {
  return `${INTEIRO.format(valor)} ${valor === 1 ? singular : plural}`;
}

/*
 * Números para quem não é especialista: "8,8 milhões de hectares", "214 mil ha", "66%". Só as
 * casas que mudam a leitura; o número exato fica nas tabelas e nas dicas.
 */

const RESUMO_SEM_CASAS = new Intl.NumberFormat("pt-BR", {
  notation: "compact",
  compactDisplay: "long",
  maximumFractionDigits: 0,
});
const RESUMO_UMA_CASA = new Intl.NumberFormat("pt-BR", {
  notation: "compact",
  compactDisplay: "long",
  maximumFractionDigits: 1,
});
const PERCENTUAL_SEM_CASAS = new Intl.NumberFormat("pt-BR", {
  style: "percent",
  maximumFractionDigits: 0,
});

/**
 * O número e a escala por extenso ("mil", "milhão", "milhões"), sem o sinal. A notação compacta
 * arredonda e só depois escolhe a escala: 999,6 ha é "1 mil ha", não "1.000 ha".
 */
function resumir(valor: number): { numero: string; escala: string } {
  const absoluto = Math.abs(valor);
  const partes = formatadorDoResumo(absoluto).formatToParts(absoluto);
  // Só o número: sem a escala ("milhões") nem o espaço antes dela.
  const numero = partes
    .filter((parte) => parte.type !== "compact" && parte.type !== "literal")
    .map((parte) => parte.value)
    .join("");
  return { numero, escala: partes.find((parte) => parte.type === "compact")?.value ?? "" };
}

/**
 * As casas dependem da grandeza: uma abaixo de 10 ("7,3"), nenhuma até mil ("830"), uma até
 * 10 mil ("1,6 mil"), nenhuma até um milhão ("214 mil") e uma daí em diante ("8,8 milhões").
 */
function formatadorDoResumo(absoluto: number): Intl.NumberFormat {
  if (absoluto < 10) return RESUMO_UMA_CASA;
  if (absoluto < 1_000) return RESUMO_SEM_CASAS;
  if (absoluto < 10_000) return RESUMO_UMA_CASA;
  if (absoluto < 1_000_000) return RESUMO_SEM_CASAS;
  return RESUMO_UMA_CASA;
}

function comEscala(escala: string, unidade: string): string {
  if (escala === "") return unidade;
  // "mil hectares", mas "milhões de hectares".
  return escala === "mil" ? `mil ${unidade}` : `${escala} de ${unidade}`;
}

/** `{ numero: "8,8", unidade: "milhões de hectares" }`, para o número em destaque. */
export function hectaresPorExtenso(valor: number): { numero: string; unidade: string } {
  const { numero, escala } = resumir(valor);
  const unidade = escala === "" && numero === "1" ? "hectare" : "hectares";
  return { numero, unidade: comEscala(escala, unidade) };
}

/** `8,8 milhões de ha`, `676 mil ha`, `830 ha`; uma lasca, `menos de 0,1 ha`. */
export function formatarHectaresResumido(valor: number): string {
  if (lasca(valor)) return MENOS_DE_UM_DECIMO;
  const { numero, escala } = resumir(valor);
  return `${numero} ${comEscala(escala, "ha")}`;
}

/** Uma contagem do mesmo jeito: `4,8 milhões de polígonos`, `1,6 mil polígonos`, `1 polígono`. */
export function formatarContagemResumida(valor: number, singular: string, plural: string): string {
  const { numero, escala } = resumir(valor);
  return `${numero} ${comEscala(escala, escala === "" && numero === "1" ? singular : plural)}`;
}

/** Fração do total: `66%`, `7,7%`, `menos de 0,1%`. */
export function formatarParticipacao(fracao: number): string {
  if (fracao > 0 && fracao < 0.001) return `${MENOS_DE}0,1%`;
  return (fracao >= 0.1 ? PERCENTUAL_SEM_CASAS : PERCENTUAL).format(fracao);
}

/** A parte `valor` de `total`, como `formatarParticipacao`; sem total, `0%`. */
export function formatarParte(valor: number, total: number): string {
  return formatarParticipacao(total > 0 ? valor / total : 0);
}
