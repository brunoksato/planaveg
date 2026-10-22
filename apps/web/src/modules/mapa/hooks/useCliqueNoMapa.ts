import { useRef, useState } from "react";

import type { CliqueMapa } from "@sinaveg/cartography";

import type { GeoServerApi } from "@/shared/api/geoserver";

import {
  geometriaDaPeca,
  identificarPecas,
  identificarPoligono,
} from "../services/identificacao.service";
import type { Identificacao } from "../types";
import type { EstadoDoMapa } from "./useEstadoDoMapa";

/** A mensagem de um erro qualquer. */
function mensagem(erro: unknown): string {
  return erro instanceof Error ? erro.message : String(erro);
}

/**
 * O clique no mapa: as peças sob ele, cada uma com o polígono clicado. Vale o último gesto: um
 * clique novo, ou o painel fechado, cancela o pedido que ainda corria (`AbortController`), e a
 * resposta dele não muda nada. Um GeoServer fora do ar aparece como erro no painel, não como um
 * ponto sem áreas.
 */
export function useCliqueNoMapa(
  geoserver: GeoServerApi,
  estado: Pick<EstadoDoMapa, "nomeCamadaPecas" | "cql">,
) {
  const [identificacao, setIdentificacao] = useState<Identificacao | undefined>();
  const pedido = useRef<AbortController | undefined>(undefined);
  const { nomeCamadaPecas, cql } = estado;

  /** Cancela o pedido do clique anterior, se ele ainda corre. */
  function cancelar() {
    pedido.current?.abort();
    pedido.current = undefined;
  }

  async function identificar(clique: CliqueMapa) {
    cancelar();
    const controle = new AbortController();
    pedido.current = controle;
    const { signal } = controle;
    setIdentificacao({ consultando: true, pecas: [] });
    try {
      const pecas = await identificarPecas(
        geoserver,
        nomeCamadaPecas,
        clique.consulta,
        cql,
        signal,
      );
      // A peça junta os polígonos de mesmos atributos no município e na bacia: o painel mostra o
      // clicado, com a peça inteira como contexto. Sem ele, o contorno é o da peça inteira, que
      // só então é pedido.
      const completas = await Promise.all(
        pecas.map(async (peca) => {
          const poligono = await identificarPoligono(geoserver, peca, clique.consulta, signal);
          const temContorno = poligono !== null && poligono.geometria !== null;
          const geometria = temContorno
            ? null
            : await geometriaDaPeca(geoserver, nomeCamadaPecas, peca, signal);
          return { ...peca, geometria, poligono };
        }),
      );
      if (signal.aborted) return;
      setIdentificacao({ consultando: false, pecas: completas });
    } catch (erro) {
      if (!signal.aborted) {
        setIdentificacao({ consultando: false, pecas: [], erro: mensagem(erro) });
      }
    }
  }

  return {
    identificacao,
    identificar,
    fecharIdentificacao: () => {
      cancelar();
      setIdentificacao(undefined);
    },
  };
}

/** O que `useCliqueNoMapa` devolve. */
export type CliqueNoMapa = ReturnType<typeof useCliqueNoMapa>;
