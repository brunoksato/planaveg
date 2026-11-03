import {
  formatarHectaresResumido,
  formatarParte,
  formatarParticipacao,
} from "@/shared/utils/formatos";

/** Um arranjo de implementação no cartão das metas, com a legenda da tabela dos arranjos. */
export type LinhaArranjo = {
  chave: string;
  titulo: string;
  cor: string;
  area: number;
  elegibilidade: readonly string[];
  atributo: readonly string[];
  nota: string | undefined;
  /** O progresso até a meta (Brasil inteiro, sem filtros); sem ele, a parte do total. */
  meta?: { meta: number; fracao: number } | undefined;
};

/**
 * Um arranjo: o título e os números, a barra (até a meta, ou a parte do total) e, embaixo, os
 * critérios de elegibilidade e o atributo espacial, lado a lado na tela larga, como na tabela.
 */
export function ItemArranjo({ linha, total }: { linha: LinhaArranjo; total: number }) {
  const { meta } = linha;
  // A barra da meta para em 100%; o número diz quanto passou.
  const largura =
    meta === undefined ? (total > 0 ? linha.area / total : 0) : Math.min(1, meta.fracao);
  const legenda = [
    { titulo: "Critérios de elegibilidade", itens: linha.elegibilidade },
    { titulo: "Atributo espacial", itens: linha.atributo },
  ];
  return (
    <li>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5">
        <h3 className="max-w-3xl text-[15px] font-semibold">{linha.titulo}</h3>
        <p className="text-sm text-muted-foreground tabular-nums">
          {formatarHectaresResumido(linha.area)}
          {meta === undefined ? (
            <> · {formatarParte(linha.area, total)}</>
          ) : (
            <>
              {" "}
              de {formatarHectaresResumido(meta.meta)} ·{" "}
              <span className="font-semibold text-foreground">
                {formatarParticipacao(meta.fracao)}
              </span>
              {meta.fracao >= 1 ? " · meta superada" : ""}
            </>
          )}
        </p>
      </div>
      <div aria-hidden className="mt-1.5 h-3 rounded-full bg-muted">
        <div
          className="h-3 rounded-full"
          style={{ width: `${String(largura * 100)}%`, backgroundColor: linha.cor }}
        />
      </div>
      {linha.elegibilidade.length === 0 && linha.atributo.length === 0 ? null : (
        <div className="mt-3 grid gap-x-8 gap-y-3 text-sm md:grid-cols-2">
          {legenda.map((parte, indice) => (
            <div
              className={indice > 0 ? "md:border-l md:border-dashed md:pl-8" : ""}
              key={parte.titulo}
            >
              <p className="text-xs font-semibold tracking-wide text-primary uppercase">
                {parte.titulo}
              </p>
              <ul className="mt-1 list-disc space-y-0.5 pl-5 text-muted-foreground">
                {parte.itens.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
      {linha.nota === undefined ? null : (
        <p className="mt-3 rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
          {linha.nota}
        </p>
      )}
    </li>
  );
}
