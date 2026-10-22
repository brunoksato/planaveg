import { useState } from "react";

import type { MunicipioBusca } from "@sinaveg/web-contracts";

import type { Feicao, GeoServerApi } from "@/shared/api/geoserver";
import { AutocompleteDominio } from "@/shared/components/AutocompleteDominio";

import { useSugestoesDeMunicipio } from "../services/municipios.queries";
import { LIMITE_DE_SUGESTOES } from "../services/municipios.service";

/** "Ir para um município…": a busca pelo nome, com sugestões a partir de dois caracteres. */
export function BuscaDeMunicipio({
  geoserver,
  valor,
  rotulo,
  onEscolher,
}: {
  geoserver: GeoServerApi;
  /** O código do município escolhido. */
  valor: string | undefined;
  rotulo: string | undefined;
  /** O código escolhido e, se já veio na sugestão, a feição dele (para o mapa ir até lá). */
  onEscolher: (codigo: string | undefined, feicao: Feicao<MunicipioBusca> | undefined) => void;
}) {
  const [consulta, setConsulta] = useState("");
  const sugestoes = useSugestoesDeMunicipio(geoserver, consulta);
  return (
    <div>
      <label className="sr-only" htmlFor="busca-municipio">
        Ir para um município
      </label>
      <AutocompleteDominio
        carregando={sugestoes.isFetching}
        consulta={consulta}
        id="busca-municipio"
        maisResultados={(sugestoes.data?.length ?? 0) >= LIMITE_DE_SUGESTOES}
        // O município não filtra o mapa: tirá-lo apaga o contorno e o CSV dele.
        nomeDoRemover={(escolhido) => `Tirar ${escolhido} do mapa`}
        onChange={(codigo) =>
          onEscolher(
            codigo,
            sugestoes.data?.find((f) => f.propriedades.cod_municipio === codigo),
          )
        }
        onConsultaChange={setConsulta}
        opcoes={(sugestoes.data ?? []).map((f) => ({
          valor: f.propriedades.cod_municipio,
          rotulo: f.propriedades.rotulo,
        }))}
        placeholder="Ir para um município…"
        valor={valor}
        valorRotulo={rotulo}
      />
    </div>
  );
}
