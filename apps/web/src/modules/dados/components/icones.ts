import { Download, FileText, Globe, type LucideIcon } from "lucide-react";

import type { SecaoDados } from "../utils/secoes";

/**
 * O ícone de cada parte de Acesso aos dados, nos cartões e no índice. Fica fora da lista das
 * partes: o schema da rota importa a lista (no bundle principal), e os ícones só servem à página,
 * que carrega quando abre.
 */
export const ICONES: Readonly<Record<SecaoDados, LucideIcon>> = {
  downloads: Download,
  metadados: FileText,
  servicos: Globe,
};
