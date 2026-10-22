import type { CatalogoArranjo } from "@sinaveg/web-contracts";

import {
  formatarHectaresResumido,
  formatarParte,
  formatarParticipacao,
  hectaresPorExtenso,
} from "@/shared/utils/formatos";
import { termoArranjo } from "@/shared/utils/glossario";
import { notaDoResto, progressoDasMetas, separarArranjos } from "@/shared/utils/metas";

/**
 * O número principal do portal: quanto já se atingiu da meta nacional do Planaveg (todo o cômputo
 * sobre a soma das metas dos arranjos) e, numa barra, a parte de cada arranjo no que já se
 * atingiu, como a revisão da MMA de 16/10/2026 pede. Os três arranjos do plano têm nome na
 * legenda; as demais áreas de projetos são a faixa cinza do fim, com uma nota. Sem ano: o SINAVEG
 * não compara os anos.
 */
export function Destaque({
  arranjos,
  porArranjo,
}: {
  arranjos: readonly CatalogoArranjo[];
  porArranjo: ReadonlyMap<string, number>;
}) {
  const parte = (a: CatalogoArranjo) => ({
    chave: a.arranjo,
    nome: termoArranjo(a.arranjo, a.titulo).nome,
    cor: a.cor,
    area: porArranjo.get(a.arranjo) ?? 0,
    ausente: a.motivo_ausencia !== null,
  });
  const { doPlano, resto } = separarArranjos(arranjos);
  const doPlanoComArea = doPlano.map(parte);
  // As demais áreas de projetos, só com área: a faixa cinza da barra e a nota.
  const restoComArea = resto.map(parte).filter((p) => p.area > 0);
  const partes = [...doPlanoComArea, ...restoComArea];
  const total = partes.reduce((soma, p) => soma + p.area, 0);
  const progresso = progressoDasMetas(arranjos, porArranjo);
  const { numero, unidade } = hectaresPorExtenso(total);
  return (
    <section
      aria-labelledby="resumo-titulo"
      className="rounded-2xl border bg-card px-5 py-7 shadow-xs sm:px-10 sm:py-9"
    >
      <h2 className="text-base font-medium text-muted-foreground" id="resumo-titulo">
        Quanto já atingimos da meta nacional
      </h2>
      <p className="mt-2 flex flex-wrap items-baseline gap-x-3">
        <span className="text-5xl font-semibold tracking-tight text-primary tabular-nums sm:text-6xl">
          {numero}
        </span>
        <span className="text-2xl font-medium sm:text-3xl">{unidade}</span>
      </p>
      {progresso === undefined ? null : (
        <p className="mt-2 text-lg text-muted-foreground">
          <strong className="font-semibold text-foreground">
            {formatarParticipacao(progresso.total.fracao)}
          </strong>{" "}
          da meta de {formatarHectaresResumido(progresso.total.meta)} até {progresso.total.ano}
        </p>
      )}
      {total > 0 ? (
        // A parte de cada arranjo no que já se atingiu, nas cores do mapa; a lista diz os números.
        <div aria-hidden className="mt-6 flex h-4 gap-[2px] overflow-hidden rounded-full bg-muted">
          {partes.map((p) =>
            p.area > 0 ? (
              <span
                className="h-full"
                key={p.chave}
                style={{ width: `${String((p.area / total) * 100)}%`, backgroundColor: p.cor }}
              />
            ) : null,
          )}
        </div>
      ) : null}
      <ul
        aria-label="A parte de cada arranjo no que já se atingiu"
        className="mt-4 grid gap-x-8 gap-y-2 text-[15px] md:grid-cols-2"
      >
        {doPlanoComArea.map((p) => (
          <li className="flex items-start gap-2" key={p.chave}>
            <span
              aria-hidden
              className="mt-1.5 size-3 shrink-0 rounded-[3px]"
              style={{ backgroundColor: p.cor }}
            />
            <span className="min-w-0 flex-1 leading-snug">{p.nome}</span>
            <span className="shrink-0 text-muted-foreground tabular-nums">
              {p.ausente && p.area <= 0 ? "zerado por enquanto" : formatarParte(p.area, total)}
            </span>
          </li>
        ))}
      </ul>
      {restoComArea.map((p) => (
        <p className="mt-3 flex items-start gap-2 text-sm text-muted-foreground" key={p.chave}>
          <span
            aria-hidden
            className="mt-1 size-3 shrink-0 rounded-[3px]"
            style={{ backgroundColor: p.cor }}
          />
          {notaDoResto(p.nome, p.area, total)}
        </p>
      ))}
    </section>
  );
}
