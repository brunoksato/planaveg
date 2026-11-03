import { Layers } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { CHAVES_DOS_MAPAS_BASE, MAPAS_BASE, type MapaBase } from "@sinaveg/cartography";

import { Segmentado } from "@/shared/components/Segmentado";
import { nomeMapaBase } from "@/shared/utils/glossario";

import type { AlteracaoMapa } from "../types";
import { BotaoMapa } from "./BotaoMapa";

/**
 * O fundo do mapa e a intensidade das cores, num painel sobre o próprio mapa: abre no botão,
 * fecha no mesmo botão, com Esc ou com um clique fora.
 */
export function AparenciaDoMapa({
  mapaBase,
  opacidade,
  onMudar,
}: {
  mapaBase: MapaBase;
  /** De 0,1 a 1. */
  opacidade: number;
  onMudar: (alteracao: AlteracaoMapa) => void;
}) {
  const [aberta, setAberta] = useState(false);
  const raiz = useRef<HTMLDivElement>(null);
  const botao = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!aberta) return;
    const clicarFora = (evento: PointerEvent) => {
      if (!raiz.current?.contains(evento.target as Node)) setAberta(false);
    };
    const teclar = (evento: KeyboardEvent) => {
      if (evento.key !== "Escape") return;
      setAberta(false);
      botao.current?.focus();
    };
    document.addEventListener("pointerdown", clicarFora);
    document.addEventListener("keydown", teclar);
    return () => {
      document.removeEventListener("pointerdown", clicarFora);
      document.removeEventListener("keydown", teclar);
    };
  }, [aberta]);
  const percentual = Math.round(opacidade * 100);
  return (
    <div className="relative" ref={raiz}>
      <BotaoMapa
        controla="aparencia-do-mapa"
        expandido={aberta}
        onClick={() => setAberta(!aberta)}
        ref={botao}
        rotulo="Aparência do mapa"
      >
        <Layers aria-hidden className="size-4" />
      </BotaoMapa>
      {aberta ? (
        <div
          className="absolute top-0 right-11 w-64 space-y-4 rounded-xl border bg-card p-4 shadow-lg"
          id="aparencia-do-mapa"
        >
          <Segmentado
            legenda="Fundo do mapa"
            onChange={(chave) => onMudar({ mapaBase: chave })}
            opcoes={CHAVES_DOS_MAPAS_BASE.map((chave) => ({
              valor: chave,
              rotulo: nomeMapaBase(chave, MAPAS_BASE[chave].rotulo),
            }))}
            valor={mapaBase}
          />
          <div>
            <label className="mb-2 block text-sm font-medium" htmlFor="opacidade">
              Intensidade das cores: {percentual}%
            </label>
            <input
              className="w-full accent-primary"
              id="opacidade"
              max={100}
              min={10}
              onChange={(evento) => onMudar({ opacidade: Number(evento.target.value) })}
              step={5}
              type="range"
              value={percentual}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
