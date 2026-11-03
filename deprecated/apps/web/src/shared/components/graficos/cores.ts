/**
 * As seis cores categóricas dos gráficos, em ordem: as das condições do CAR, dos processos dos
 * projetos, dos biomas e das esferas e tipos de UC saem daqui.
 */
export const PALETA = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300"] as const;

/** O tom dos gráficos de uma cor só: o primeiro da paleta. */
export const COR_UNICA = PALETA[0];

/** Luminância relativa a partir da qual o texto sobre a cor fica escuro (mesmo contraste com branco e preto). */
const LUMINANCIA_TEXTO_ESCURO = 0.179;

/** Texto escuro ou branco, o que tiver mais contraste com a cor de fundo (`#rrggbb`). */
export function corDoTextoSobre(cor: string): string {
  const canais = [1, 3, 5].map((inicio) => {
    const valor = Number.parseInt(cor.slice(inicio, inicio + 2), 16) / 255;
    return valor <= 0.039_28 ? valor / 12.92 : ((valor + 0.055) / 1.055) ** 2.4;
  });
  const [r = 0, g = 0, b = 0] = canais;
  const luminancia = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminancia > LUMINANCIA_TEXTO_ESCURO ? "#12211b" : "#ffffff";
}
