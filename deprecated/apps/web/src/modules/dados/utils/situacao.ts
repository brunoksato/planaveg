import type { TomStatus } from "@sinaveg/ui";
import type { CatalogoFiltro } from "@sinaveg/web-contracts";

/** Como cada situação dos dados de um tema aparece: o rótulo e o tom da etiqueta. */
export const SITUACAO: Record<CatalogoFiltro["status"], { rotulo: string; tom: TomStatus }> = {
  presente: { rotulo: "Completos", tom: "success" },
  parcial: { rotulo: "Parciais", tom: "warning" },
  vazio: { rotulo: "Sem áreas", tom: "neutral" },
};
