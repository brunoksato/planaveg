import type { FonteAusente } from "@sinaveg/web-contracts";

import type { Catalogo } from "@/shared/services/catalogo.service";
import { nomeGrupoDeFiltro } from "@/shared/utils/glossario";

import { Bloco } from "./Bloco";

/**
 * O que o relatório pede e a base não traz (`fonte_ausente`), por grupo, na ordem do contrato.
 * Os grupos são os do relatório, os mesmos dos temas, e o nome deles vem do mesmo glossário. Sem
 * nada faltando, o bloco não aparece.
 */
export function VisaoFontesAusentes({ dados }: { dados: Catalogo }) {
  if (dados.ausentes.length === 0) return null;
  return (
    <Bloco
      descricao="O relatório da metodologia pede estes dados, mas o arquivo ainda não os traz. Nenhum deles é deduzido de outra fonte: cada um entra quando a base o trouxer."
      id="fontes-ausentes"
      titulo="O que a base ainda não traz"
    >
      <div className="space-y-5">
        {porGrupo(dados.ausentes).map(([grupo, fontes]) => (
          <div key={grupo}>
            <h4 className="text-[15px] font-semibold">{nomeGrupoDeFiltro(grupo)}</h4>
            <ul className="mt-2 list-disc space-y-1.5 pl-5 text-[15px] leading-relaxed">
              {fontes.map((fonte) => (
                <li key={fonte.codigo}>{fonte.descricao}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </Bloco>
  );
}

/** As fontes de cada grupo, com os grupos na ordem em que aparecem pela primeira vez. */
function porGrupo(fontes: readonly FonteAusente[]): [string, FonteAusente[]][] {
  const grupos = new Map<string, FonteAusente[]>();
  for (const fonte of fontes) {
    const doGrupo = grupos.get(fonte.grupo);
    if (doGrupo === undefined) grupos.set(fonte.grupo, [fonte]);
    else doGrupo.push(fonte);
  }
  return [...grupos];
}
