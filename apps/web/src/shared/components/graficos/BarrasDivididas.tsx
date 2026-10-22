import { formatarHectaresResumido, formatarParte } from "@/shared/utils/formatos";

import { dica } from "./dica";
import { LINHA } from "./grade";
import { LegendaDoGrafico } from "./LegendaDoGrafico";
import type { SegmentoEmpilhado } from "./tipos";

/**
 * A grade das barras divididas. Além da barra, a coluna do meio leva os percentuais escritos, que
 * não cabem ao lado do nome e da área num cartão de meia largura: até `@3xl`, nome e área numa
 * linha e a barra com os percentuais embaixo, em toda a largura; a partir daí, lado a lado.
 */
const GRADE_DIVIDIDA =
  "grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 @3xl:grid-cols-[minmax(10rem,19rem)_minmax(0,1fr)_auto]";

/**
 * Uma barra por categoria, dividida nas mesmas partes (ex.: tipo de área do CAR × situação do
 * cadastro). Cada barra vai de 0 a 100%: compara a divisão, e a área total fica escrita ao lado.
 */
export function BarrasDivididas({
  linhas,
  segmentos,
}: {
  linhas: ReadonlyArray<{ chave: string; rotulo: string; valores: Record<string, number> }>;
  segmentos: readonly SegmentoEmpilhado[];
}) {
  return (
    <div className="space-y-5">
      <LegendaDoGrafico itens={segmentos} />
      <ul className={`${GRADE_DIVIDIDA} gap-y-5`}>
        {linhas.map((linha) => {
          const total = Object.values(linha.valores).reduce((a, b) => a + b, 0);
          return (
            <li className={LINHA} key={linha.chave}>
              {/* Estreito, nome e área total numa linha e a barra com os percentuais embaixo. */}
              <span className="min-w-0 text-[15px] leading-snug">{linha.rotulo}</span>
              <span className="text-right text-sm whitespace-nowrap tabular-nums @3xl:col-start-3 @3xl:row-start-1">
                {formatarHectaresResumido(total)}
              </span>
              <span className="col-span-2 flex min-w-0 flex-col gap-1.5 @3xl:col-span-1 @3xl:col-start-2 @3xl:row-start-1">
                <span aria-hidden className="flex h-5 gap-[2px] @3xl:h-6">
                  {segmentos.map((s) => {
                    const valor = linha.valores[s.chave] ?? 0;
                    if (valor <= 0) return null;
                    return (
                      <span
                        className="h-full first:rounded-l-[4px] last:rounded-r-[4px]"
                        key={s.chave}
                        style={{ backgroundColor: s.cor, flexGrow: valor, flexBasis: 0 }}
                        title={dica(`${linha.rotulo} · ${s.rotulo}`, valor, total)}
                      />
                    );
                  })}
                </span>
                <span className="flex flex-wrap gap-x-4 gap-y-0.5 text-sm text-muted-foreground">
                  {segmentos.map((s) => (
                    <span className="whitespace-nowrap" key={s.chave}>
                      {s.rotulo}{" "}
                      <span className="font-medium text-foreground tabular-nums">
                        {formatarParte(linha.valores[s.chave] ?? 0, total)}
                      </span>
                    </span>
                  ))}
                </span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
