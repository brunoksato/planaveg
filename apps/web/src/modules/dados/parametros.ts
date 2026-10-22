import * as z from "zod/mini";

import { naBusca } from "@/shared/utils/parametros";

import { SECOES } from "./utils/secoes";

/**
 * Os parâmetros de Acesso aos dados na URL: a parte aberta (sem ela, os três cartões). Uma parte
 * que não existe fica de fora, e a página mostra os cartões.
 */
export const parametrosDosDados = z.object({
  secao: naBusca(z.enum(SECOES.map((parte) => parte.id))),
});
