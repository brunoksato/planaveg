import { ListFilter } from "lucide-react";

import type { CatalogoNivel } from "@sinaveg/web-contracts";

import type { Resumo } from "@/modules/filtros";
import {
  formatarHectaresResumido,
  formatarParte,
  formatarParticipacao,
} from "@/shared/utils/formatos";
import { ORDEM_DOS_CRITERIOS, termoCriterio } from "@/shared/utils/glossario";
import { type ProgressoDasMetas } from "@/shared/utils/metas";
import { somar } from "@/shared/utils/numeros";

import { textoDosPoligonos } from "../../utils/assuntos";
import { fontesDoCriterio } from "../../utils/fontes";
import { Numero } from "./Numero";

/**
 * Os indicadores no topo do painel: a área em recuperação (com os polígonos, como o mapa os
 * conta) e a parte de cada fonte numa barra, o progresso da meta nacional (só no Brasil inteiro,
 * sem filtros) e os dois critérios do cômputo, cada um com as fontes dele, como na tabela de
 * critérios do Planaveg.
 */
export function IndicadoresDoPainel({
  atual,
  niveis,
  metas,
  filtro,
}: {
  atual: Resumo;
  niveis: readonly CatalogoNivel[];
  metas?: ProgressoDasMetas | undefined;
  /** Com filtro, quanto a área é do total sem filtro ("Só as áreas filtradas: …"). */
  filtro?: string | undefined;
}) {
  const total = atual.total.area;
  const criterios = ORDEM_DOS_CRITERIOS.map((criterio) => {
    const fontes = fontesDoCriterio(niveis, criterio, atual.porNivel);
    return {
      chave: criterio,
      termo: termoCriterio(criterio),
      fontes,
      valor: somar(fontes),
    };
  });
  return (
    <section aria-labelledby="indicadores-titulo" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold" id="indicadores-titulo">
          Vegetação nativa em recuperação
        </h2>
        <span className="rounded-full border bg-card px-2.5 py-0.5 text-[13px] text-muted-foreground">
          Estimativa técnica
        </span>
      </div>
      <div className={`grid gap-3 ${metas === undefined ? "" : "lg:grid-cols-3"}`}>
        {/* O número principal, com a parte de cada fonte numa barra. */}
        <div
          className={`flex flex-col rounded-xl border bg-card p-5 ${metas === undefined ? "" : "lg:col-span-2"}`}
        >
          <p className="text-sm text-muted-foreground">Área em recuperação</p>
          <Numero destaque grande valor={formatarHectaresResumido(total)} />
          <p className="mt-2 mb-4 flex min-h-6 items-center text-[13px] text-muted-foreground">
            {textoDosPoligonos(atual.total.poligonos)}
          </p>
          {total > 0 ? (
            // A mesma parte de cada fonte que os cartões abaixo escrevem, nas cores do mapa.
            <div aria-hidden className="mt-auto flex h-2.5 gap-[2px] overflow-hidden rounded-full">
              {criterios.flatMap((c) =>
                c.fontes.map((f) =>
                  f.valor > 0 ? (
                    <span
                      className="h-full"
                      key={f.chave}
                      style={{
                        width: `${String((f.valor / total) * 100)}%`,
                        backgroundColor: f.cor,
                      }}
                    />
                  ) : null,
                ),
              )}
            </div>
          ) : null}
        </div>
        {metas === undefined ? null : (
          <div className="flex flex-col rounded-xl border bg-card p-5">
            <p className="text-sm text-muted-foreground">Meta de {metas.total.ano}</p>
            <Numero grande valor={formatarParticipacao(metas.total.fracao)} />
            {/* Na mesma linha dos polígonos no cartão ao lado, e a barra na mesma altura. */}
            <p className="mt-2 mb-4 flex min-h-6 items-center text-[13px] text-muted-foreground">
              de {formatarHectaresResumido(metas.total.meta)}
            </p>
            {/* A barra para em 100%; o número diz quanto passou. */}
            <div aria-hidden className="mt-auto h-2.5 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary"
                style={{ width: `${String(Math.min(100, metas.total.fracao * 100))}%` }}
              />
            </div>
          </div>
        )}
      </div>
      <ul className="grid gap-3 md:grid-cols-2">
        {criterios.map((criterio) => (
          <li className="rounded-xl border bg-card px-5 py-4" key={criterio.chave}>
            <p className="text-sm font-semibold">{criterio.termo.nome}</p>
            <p className="text-[13px] text-muted-foreground">{criterio.termo.descricao}</p>
            <div className="flex flex-wrap items-baseline justify-between gap-x-3">
              <Numero valor={formatarHectaresResumido(criterio.valor)} />
              <p className="text-[13px] text-muted-foreground">
                {formatarParte(criterio.valor, total)} do total
              </p>
            </div>
            <ul
              aria-label={`Fontes de ${criterio.termo.nome.toLocaleLowerCase("pt-BR")}`}
              className="mt-3 space-y-1.5 border-t pt-3"
            >
              {criterio.fontes.map((fonte) => (
                <li
                  className="flex items-baseline justify-between gap-x-3 text-sm"
                  key={fonte.chave}
                  title={fonte.descricao}
                >
                  <span className="flex min-w-0 items-baseline gap-2">
                    <span
                      aria-hidden
                      className="size-2.5 shrink-0 translate-y-px rounded-[3px]"
                      style={{ backgroundColor: fonte.cor }}
                    />
                    {fonte.rotulo}
                  </span>
                  <span className="whitespace-nowrap text-muted-foreground tabular-nums">
                    {fonte.presente ? formatarHectaresResumido(fonte.valor) : "sem dados"}
                  </span>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
      {filtro === undefined ? null : (
        <p className="flex items-center gap-2 text-[15px] font-medium text-primary">
          <ListFilter aria-hidden className="size-4 shrink-0" />
          {filtro}
        </p>
      )}
    </section>
  );
}
