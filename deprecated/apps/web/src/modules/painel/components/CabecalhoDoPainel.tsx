import { Link } from "@tanstack/react-router";
import { ArrowLeft, MapIcon } from "lucide-react";

import type { NomeDimensao } from "@/shared/utils/glossario";
import { maiuscula } from "@/shared/utils/textos";

import type { DadosDoPainel } from "../hooks/usePainel";

/**
 * O topo da coluna dos números: que lugar é (Brasil, ou um estado, município…), o link para o
 * mesmo lugar e os mesmos filtros no mapa e a volta ao Brasil inteiro.
 */
export function CabecalhoDoPainel({
  lugar,
  nomes,
  chave,
  buscaMapa,
  mapaSemLugar,
  onVerBrasil,
}: {
  lugar: string;
  nomes: NomeDimensao | undefined;
  chave: string | undefined;
  /** O estado do mapa com o mesmo ano, filtros e lugar. */
  buscaMapa: DadosDoPainel["buscaMapa"];
  /** O lugar não tem contorno no mapa (bacias, regiões): o link leva ao Brasil filtrado. */
  mapaSemLugar: boolean;
  onVerBrasil: () => void;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-primary">
          {nomes === undefined || chave === undefined ? "Painel" : maiuscula(nomes.singular)}
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
          {lugar}
        </h1>
      </div>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        <Link
          className="inline-flex items-center gap-1.5 text-[15px] font-medium text-primary hover:underline"
          search={buscaMapa}
          to="/mapa"
        >
          <MapIcon aria-hidden className="size-4" />
          {mapaSemLugar ? "Ver os filtros no mapa do Brasil" : "Ver no mapa"}
        </Link>
        {chave === undefined ? null : (
          <button
            className="inline-flex items-center gap-1.5 text-[15px] font-medium text-primary hover:underline"
            onClick={onVerBrasil}
            type="button"
          >
            <ArrowLeft aria-hidden className="size-4" />
            Ver o Brasil inteiro
          </button>
        )}
      </div>
    </header>
  );
}
