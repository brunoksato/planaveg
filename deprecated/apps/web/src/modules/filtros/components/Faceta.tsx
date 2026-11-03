import { ChevronDown } from "lucide-react";
import { useState } from "react";

import { formatarHectaresResumido } from "@/shared/utils/formatos";

import type { Opcao } from "../utils/opcoes";

/**
 * Uma lista de filtro na lateral, num acordeão com as mesmas medidas das outras seções: o título,
 * a contagem de marcados e uma caixa por opção, com a área que sobra se ela for escolhida.
 */
export function Faceta({
  titulo,
  nota,
  opcoes,
  escolhidos,
  totais,
  carregando,
  aberta: abertaDeInicio,
  todosPorPadrao = false,
  onAlternar,
}: {
  titulo: string;
  nota?: string | undefined;
  opcoes: readonly Opcao[];
  escolhidos: readonly string[];
  totais: ReadonlyMap<string, { area: number }>;
  carregando: boolean;
  /** Abre de início (a legenda), mesmo sem escolha. */
  aberta: boolean;
  /** Sem escolha, todas as opções aparecem marcadas: é o padrão, não "nenhuma". */
  todosPorPadrao?: boolean;
  onAlternar: (valor: string) => void;
}) {
  // Abre sozinha na legenda ou quando já há escolha (link compartilhado); depois, quem manda é
  // a pessoa.
  const [aberta, setAberta] = useState(abertaDeInicio || escolhidos.length > 0);
  const padrao = todosPorPadrao && escolhidos.length === 0;
  // Só os valores da lista: `nenhum` (todos os tipos tirados) não é uma opção.
  const valores = new Set(opcoes.map((o) => o.valor));
  const marcados = padrao ? [...valores] : escolhidos.filter((v) => valores.has(v));
  const conjuntoMarcados = new Set(marcados);
  return (
    // Uma seção da lateral, com as mesmas medidas das outras (`SecaoCompartilhar`).
    <details
      className="border-b"
      onToggle={(evento) => setAberta(evento.currentTarget.open)}
      open={aberta}
    >
      <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-2.5 text-sm font-semibold hover:bg-muted/50 [&::-webkit-details-marker]:hidden">
        <span className="flex-1">{titulo}</span>
        <Contagem
          escolhidos={escolhidos.length}
          marcados={marcados.length}
          opcoes={opcoes.length}
          todosPorPadrao={todosPorPadrao}
        />
        <ChevronDown
          aria-hidden
          className={`size-4 text-muted-foreground transition-transform ${aberta ? "rotate-180" : ""}`}
        />
      </summary>
      <div className="space-y-3 px-2 pt-0.5 pb-3">
        {nota === undefined ? null : (
          <p className="px-2 text-[13px] text-muted-foreground">{nota}</p>
        )}
        {carregando && opcoes.length === 0 ? (
          <p className="px-2 text-[13px] text-muted-foreground">Carregando…</p>
        ) : null}
        {[...porGrupo(opcoes)].map(([grupo, doGrupo]) => (
          <fieldset className="space-y-0.5" key={grupo ?? "_"}>
            <legend
              className={
                grupo === undefined
                  ? "sr-only"
                  : "mb-0.5 px-2 text-[13px] font-semibold text-muted-foreground"
              }
            >
              {grupo ?? titulo}
            </legend>
            {doGrupo.map((opcao) => (
              <OpcaoDaFaceta
                apagada={marcados.length > 0 && !conjuntoMarcados.has(opcao.valor)}
                area={totais.get(opcao.valor)?.area ?? 0}
                carregando={carregando}
                key={opcao.valor}
                marcada={conjuntoMarcados.has(opcao.valor)}
                onAlternar={() => onAlternar(opcao.valor)}
                opcao={opcao}
              />
            ))}
          </fieldset>
        ))}
      </div>
    </details>
  );
}

/** As opções de cada grupo, na ordem da lista; as sem grupo ficam em `undefined`. */
function porGrupo(opcoes: readonly Opcao[]): Map<string | undefined, Opcao[]> {
  const grupos = new Map<string | undefined, Opcao[]>();
  for (const opcao of opcoes) {
    const doGrupo = grupos.get(opcao.grupo) ?? [];
    doGrupo.push(opcao);
    grupos.set(opcao.grupo, doGrupo);
  }
  return grupos;
}

/**
 * A contagem no título, sempre à vista: "10/10" nos tipos (todos é o padrão), "Todos" numa lista
 * sem escolha (não filtra nada) e "2/27" com escolha.
 */
function Contagem({
  marcados,
  opcoes,
  escolhidos,
  todosPorPadrao,
}: {
  marcados: number;
  opcoes: number;
  escolhidos: number;
  todosPorPadrao: boolean;
}) {
  return (
    <span
      className={`inline-flex h-5 items-center rounded-full px-2 text-xs font-medium tabular-nums ${escolhidos > 0 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
    >
      {todosPorPadrao || escolhidos > 0 ? (
        <>
          {marcados}/{opcoes}
          <span className="sr-only"> marcados</span>
        </>
      ) : (
        <>
          Todos<span className="sr-only">, sem filtro</span>
        </>
      )}
    </span>
  );
}

/** Uma opção: a caixa, a cor, o nome (com a nota) e a área que sobra se ela for escolhida. */
function OpcaoDaFaceta({
  opcao,
  area,
  marcada,
  apagada,
  carregando,
  onAlternar,
}: {
  opcao: Opcao;
  area: number;
  marcada: boolean;
  /** Com escolha, a cor do que ficou fora do mapa fica apagada. */
  apagada: boolean;
  carregando: boolean;
  onAlternar: () => void;
}) {
  const vazia = !carregando && area <= 0 && !marcada;
  // Com nota, a caixa e o número ficam na linha do nome, no alto.
  const comNota = opcao.nota !== undefined;
  return (
    <label
      className={`flex min-h-8 gap-2.5 rounded-md px-2 py-1 ${comNota ? "items-start" : "items-center"} ${vazia ? "cursor-not-allowed text-muted-foreground" : "cursor-pointer hover:bg-muted"}`}
    >
      <input
        checked={marcada}
        className={
          comNota ? "mt-0.5 size-4 shrink-0 accent-primary" : "size-4 shrink-0 accent-primary"
        }
        disabled={vazia}
        onChange={onAlternar}
        type="checkbox"
      />
      {opcao.cor === undefined ? null : (
        <span
          aria-hidden
          className={`size-3 shrink-0 rounded-[3px] ${apagada ? "opacity-35" : ""}`}
          style={{ backgroundColor: opcao.cor }}
        />
      )}
      <span className="min-w-0 flex-1 text-sm leading-snug">
        {opcao.nome}
        {opcao.nota === undefined ? null : (
          <span className="mt-0.5 block text-xs text-muted-foreground">{opcao.nota}</span>
        )}
      </span>
      {/* Largura fixa: a área mudar com o filtro não quebra o nome em outra linha. */}
      <span className="w-24 shrink-0 text-right text-[13px] whitespace-nowrap text-muted-foreground tabular-nums">
        {carregando ? "…" : formatarHectaresResumido(area)}
      </span>
    </label>
  );
}
