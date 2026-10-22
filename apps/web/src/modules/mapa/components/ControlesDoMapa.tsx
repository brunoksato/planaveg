import { Crosshair, Minus, Plus, RotateCcw } from "lucide-react";
import type { RefObject } from "react";

import type { MapaBase, MapaWmsHandle } from "@sinaveg/cartography";

import type { AlteracaoMapa } from "../types";
import { AparenciaDoMapa } from "./AparenciaDoMapa";
import { BotaoMapa } from "./BotaoMapa";

/** Os botões no canto do mapa: aproximar, afastar, voltar ao Brasil, ir ao município, aparência. */
export function ControlesDoMapa({
  mapa,
  mapaBase,
  opacidade,
  temMunicipio,
  onIrAoMunicipio,
  onEstadoChange,
}: {
  mapa: RefObject<MapaWmsHandle | null>;
  mapaBase: MapaBase;
  opacidade: number;
  /** Há um município escolhido (o botão de ir até ele aparece). */
  temMunicipio: boolean;
  onIrAoMunicipio: () => void;
  onEstadoChange: (alteracao: AlteracaoMapa) => void;
}) {
  return (
    <div className="absolute top-3 right-3 z-[1000] flex flex-col gap-1">
      <BotaoMapa onClick={() => mapa.current?.aproximar()} rotulo="Aproximar">
        <Plus aria-hidden className="size-4" />
      </BotaoMapa>
      <BotaoMapa onClick={() => mapa.current?.afastar()} rotulo="Afastar">
        <Minus aria-hidden className="size-4" />
      </BotaoMapa>
      <BotaoMapa
        onClick={() => {
          mapa.current?.redefinirVista();
          onEstadoChange({ municipio: undefined });
        }}
        rotulo="Voltar à vista do Brasil"
      >
        <RotateCcw aria-hidden className="size-4" />
      </BotaoMapa>
      {temMunicipio ? (
        <BotaoMapa onClick={onIrAoMunicipio} rotulo="Ir para o município">
          <Crosshair aria-hidden className="size-4" />
        </BotaoMapa>
      ) : null}
      <AparenciaDoMapa mapaBase={mapaBase} onMudar={onEstadoChange} opacidade={opacidade} />
    </div>
  );
}
