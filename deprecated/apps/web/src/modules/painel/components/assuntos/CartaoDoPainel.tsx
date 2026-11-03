import { Download, Table2 } from "lucide-react";
import { type ReactNode, useState } from "react";

import type { Indicador } from "../../types";
import type { Csv } from "../../utils/csv";

/**
 * Um cartão do painel: o título curto, o número principal (quando há) e o gráfico; a tabela com
 * os números exatos e o CSV no rodapé. O cartão largo ocupa a linha inteira da grade.
 */
export function CartaoDoPainel({
  id,
  titulo,
  indicador,
  explicacao,
  tabela,
  csv,
  largura = "metade",
  children,
}: {
  id: string;
  titulo: string;
  indicador?: Indicador | undefined;
  explicacao?: ReactNode;
  tabela?: ReactNode;
  csv?: Csv | undefined;
  largura?: "metade" | "inteira";
  children: ReactNode;
}) {
  const [tabelaAberta, setTabelaAberta] = useState(false);
  return (
    <section
      aria-labelledby={`${id}-titulo`}
      className={`flex min-w-0 scroll-mt-6 flex-col rounded-2xl border bg-card p-5 shadow-xs sm:p-6 ${largura === "inteira" ? "xl:col-span-2" : ""}`}
      id={id}
    >
      <h2 className="text-base font-semibold text-balance" id={`${id}-titulo`}>
        {titulo}
      </h2>
      {indicador === undefined ? null : (
        <p className="mt-1 flex flex-wrap items-baseline gap-x-2">
          <span className="text-3xl font-semibold tracking-tight tabular-nums">
            {indicador.valor}
          </span>
          {indicador.rotulo === undefined ? null : (
            <span className="text-sm text-muted-foreground">{indicador.rotulo}</span>
          )}
        </p>
      )}
      {explicacao === undefined ? null : (
        <p className="mt-1.5 text-sm text-muted-foreground">{explicacao}</p>
      )}
      <div className="mt-5 flex-1">{children}</div>
      {tabela === undefined && csv === undefined ? null : (
        <RodapeDoCartao
          aberta={tabelaAberta}
          csv={csv}
          id={id}
          onAlternar={() => setTabelaAberta(!tabelaAberta)}
          tabela={tabela}
        />
      )}
    </section>
  );
}

/** O rodapé do cartão: o botão que abre a tabela dos números, o link do CSV e a tabela. */
function RodapeDoCartao({
  id,
  tabela,
  csv,
  aberta,
  onAlternar,
}: {
  id: string;
  tabela: ReactNode;
  csv: Csv | undefined;
  aberta: boolean;
  onAlternar: () => void;
}) {
  return (
    <div className="mt-5 border-t pt-4">
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
        {tabela === undefined ? null : (
          <button
            aria-controls={`${id}-tabela`}
            aria-expanded={aberta}
            className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
            onClick={onAlternar}
            type="button"
          >
            <Table2 aria-hidden className="size-4" />
            {aberta ? "Esconder a tabela" : "Ver os números em tabela"}
          </button>
        )}
        {csv === undefined ? null : (
          <a
            className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
            download={csv.arquivo ?? true}
            href={csv.href}
          >
            <Download aria-hidden className="size-4" />
            {csv.rotulo}
          </a>
        )}
      </div>
      {tabela === undefined ? null : (
        <div className="mt-4 overflow-x-auto" hidden={!aberta} id={`${id}-tabela`}>
          {tabela}
        </div>
      )}
    </div>
  );
}
