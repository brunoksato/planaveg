import { useEffect } from "react";

/**
 * Um link para um assunto (/painel#tipos) chega antes de as seções existirem: rola até ele
 * quando os números terminam de carregar.
 */
export function useRolarParaOAssunto(carregando: boolean): void {
  useEffect(() => {
    if (carregando) return;
    const alvo = window.location.hash.slice(1);
    if (alvo !== "") document.getElementById(alvo)?.scrollIntoView();
  }, [carregando]);
}
