import type { CatalogoNivel } from "@sinaveg/web-contracts";

/** Um item por nível (os níveis 9–11 vêm em três linhas no catálogo, uma por condição). */
export function nivelUnicos(niveis: readonly CatalogoNivel[]): CatalogoNivel[] {
  const vistos = new Map<string, CatalogoNivel>();
  for (const nivel of niveis) if (!vistos.has(nivel.nivel)) vistos.set(nivel.nivel, nivel);
  return [...vistos.values()];
}
