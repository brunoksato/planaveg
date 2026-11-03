import { stringifySearchWith } from "@tanstack/react-router";
import * as z from "zod/mini";

/*
 * Os tipos de parâmetro das URLs do portal, para o schema da busca de cada página (o
 * `parametros.ts` de cada módulo). O roteador lê cada valor como JSON quando dá: `?ano=2024`
 * chega como número, `?chave=MT` como texto e `?municipio=5002209` como número.
 */

/**
 * Como o portal escreve a busca na URL: os textos vão como estão (`?municipio=5002209`), sem as
 * aspas que o padrão do roteador põe nos que parecem número. A leitura segue a padrão (JSON quando
 * dá), e `texto` devolve o número a texto.
 */
export const escreverBusca = stringifySearchWith(JSON.stringify);

/** Um parâmetro opcional: fora do formato, fica de fora (`undefined`) e a tela usa o padrão. */
export function naBusca<T extends z.ZodMiniType>(esquema: T) {
  return z.catch(z.optional(esquema), undefined);
}

/** Um inteiro de `minimo` a `maximo`. */
export function inteiroEntre(minimo: number, maximo: number) {
  return z.int().check(z.minimum(minimo), z.maximum(maximo));
}

/** Um número de `minimo` a `maximo`, com casas ou não. */
export function numeroEntre(minimo: number, maximo: number) {
  return z.number().check(z.minimum(minimo), z.maximum(maximo));
}

/**
 * Um texto de até `maximo` caracteres, no `formato`. Um texto só de dígitos chega como número
 * (`?municipio=5002209`) e volta a ser texto.
 */
export function texto(formato: RegExp, maximo = 200) {
  return z.pipe(
    z.union([z.string(), z.pipe(z.number(), z.transform(String))]),
    z.string().check(z.maxLength(maximo), z.regex(formato)),
  );
}
