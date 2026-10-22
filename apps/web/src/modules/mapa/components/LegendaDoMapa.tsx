import { ArrowDown, ArrowUp, ChevronDown, X } from "lucide-react";
import { useId, useState } from "react";

import { alternarTipoDeArea, type Total } from "@/modules/filtros";
import { telaLarga } from "@/shared/utils/tela";

import type { EstadoDoMapa } from "../hooks/useEstadoDoMapa";
import type { AlteracaoMapa } from "../types";
import { escreverOrdem, moverNaOrdem } from "../utils/legenda";

/**
 * A legenda sobre o mapa: cada tipo de área no mapa, de cima para baixo, na ordem e com os tipos
 * marcados da URL, com setas para mudar a ordem e × para tirá-lo (desmarca na lista). Sem nenhum,
 * diz como voltar. Os temas e os outros filtros não são camadas: valem para todas. O botão do
 * topo abre e fecha a lista, com um id próprio para o `aria-controls`.
 */
export function LegendaDoMapa({
  estado,
  areas,
  onEstadoChange,
}: {
  estado: EstadoDoMapa;
  /** A área de cada tipo com os filtros; `undefined` enquanto as facetas carregam. */
  areas: ReadonlyMap<string, Total> | undefined;
  onEstadoChange: (alteracao: AlteracaoMapa) => void;
}) {
  // Aberta no computador; no celular começa fechada, para não cobrir o mapa. Só vale na
  // montagem: virar o celular ou mudar a janela não abre nem fecha.
  const [aberta, setAberta] = useState(telaLarga);
  const corpo = useId();
  const { tipos, noMapa, filtros, ordem, ordemPadrao, camadasDaLegenda } = estado;
  const porCodigo = new Map(tipos.map((t) => [t.valor, t]));
  const itens = camadasDaLegenda.map((codigo) => {
    const tipo = porCodigo.get(codigo);
    return {
      codigo,
      nome: tipo?.nome ?? codigo,
      cor: tipo?.cor,
      // Sem área com os filtros de agora: continua na legenda, apagado.
      semArea: areas !== undefined && (areas.get(codigo)?.area ?? 0) <= 0,
    };
  });
  const total = itens.length;
  function mover(codigo: string, passo: -1 | 1) {
    onEstadoChange({
      ordem: escreverOrdem(moverNaOrdem(ordem, noMapa, codigo, passo), ordemPadrao),
    });
  }
  return (
    <section
      aria-label="Legenda do mapa"
      className="w-72 max-w-[calc(100vw-1.5rem)] rounded-xl border bg-card/95 shadow-lg backdrop-blur"
    >
      <button
        aria-controls={corpo}
        aria-expanded={aberta}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] font-semibold tracking-wide text-muted-foreground uppercase"
        onClick={() => setAberta(!aberta)}
        type="button"
      >
        <span className="flex-1">{`Legenda · ${String(total)}`}</span>
        <ChevronDown
          aria-hidden
          className={`size-4 transition-transform ${aberta ? "rotate-180" : ""}`}
        />
      </button>
      {aberta ? (
        <div className="border-t" id={corpo}>
          {total === 0 ? (
            <p className="px-3 py-2 text-[13px] text-muted-foreground">
              Nenhum tipo de área no mapa. Marque um na lista “Tipo de área”.
            </p>
          ) : null}
          <ol
            aria-label="Camadas, de cima para baixo"
            className="max-h-56 space-y-0.5 overflow-y-auto px-2 py-1.5"
          >
            {itens.map((item, indice) => (
              <ItemDaLegenda
                indice={indice}
                item={item}
                key={item.codigo}
                onMover={(passo) => mover(item.codigo, passo)}
                onTirar={() =>
                  onEstadoChange(alternarTipoDeArea(filtros, ordemPadrao, item.codigo, "nenhum"))
                }
                total={total}
              />
            ))}
          </ol>
          <p className="border-t px-3 py-1.5 text-[13px] text-muted-foreground">
            Temas e outros filtros valem para todas as camadas.
          </p>
        </div>
      ) : null}
    </section>
  );
}

const BOTAO_DA_LEGENDA =
  "rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30 disabled:hover:bg-transparent";

/** Uma camada na legenda: a cor, o nome e os botões de subir, descer e tirar do mapa. */
function ItemDaLegenda({
  item,
  indice,
  total,
  onMover,
  onTirar,
}: {
  item: { codigo: string; nome: string; cor: string | undefined; semArea: boolean };
  /** A posição, de cima para baixo, entre as `total` camadas. */
  indice: number;
  total: number;
  onMover: (passo: -1 | 1) => void;
  onTirar: () => void;
}) {
  return (
    <li className="flex items-center gap-1.5 text-[13px]">
      <span
        aria-hidden
        className={`size-3 shrink-0 rounded-[3px] border border-black/10 ${item.semArea ? "opacity-35" : ""}`}
        style={{ backgroundColor: item.cor }}
      />
      <span
        className={`min-w-0 flex-1 truncate ${item.semArea ? "text-muted-foreground" : ""}`}
        title={item.nome}
      >
        {item.nome}
        <span className="sr-only">
          {`, posição ${String(indice + 1)} de ${String(total)}`}
          {item.semArea ? ", sem área com os filtros" : ""}
        </span>
      </span>
      <button
        aria-label={`Subir ${item.nome}`}
        className={BOTAO_DA_LEGENDA}
        disabled={indice === 0}
        onClick={() => onMover(-1)}
        type="button"
      >
        <ArrowUp aria-hidden className="size-3.5" />
      </button>
      <button
        aria-label={`Descer ${item.nome}`}
        className={BOTAO_DA_LEGENDA}
        disabled={indice === total - 1}
        onClick={() => onMover(1)}
        type="button"
      >
        <ArrowDown aria-hidden className="size-3.5" />
      </button>
      <button
        aria-label={`Tirar ${item.nome} do mapa`}
        className={BOTAO_DA_LEGENDA}
        onClick={onTirar}
        type="button"
      >
        <X aria-hidden className="size-3.5" />
      </button>
    </li>
  );
}
