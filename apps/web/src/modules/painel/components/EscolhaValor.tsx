import { useState } from "react";

import type { GeoServerApi } from "@/shared/api/geoserver";
import { AutocompleteDominio } from "@/shared/components/AutocompleteDominio";
import { formatarHectaresResumido } from "@/shared/utils/formatos";
import { type NomeDimensao, palavrasDoGenero } from "@/shared/utils/glossario";
import { temOTermo, termoDeBusca } from "@/shared/utils/textos";

import { useBuscaDeLugar } from "../services/lugar.queries";
import { LIMITE_DA_BUSCA, type ValorRanking } from "../services/lugar.service";
import { unicos } from "../utils/opcoes-de-lugar";

/**
 * Até quantos lugares a lista vem inteira do ranking (estados, biomas, regiões), e mostra todos;
 * com mais (municípios, bacias), a busca vai ao GeoServer e mostra o que ele achar, até
 * `LIMITE_DA_BUSCA`. A lista rola.
 */
const LIMITE_DA_LISTA_INTEIRA = 60;

/**
 * A escolha do lugar (qual estado, município, bacia…). Com poucos valores (estados, biomas,
 * regiões), a lista vem toda do ranking; com muitos (municípios, bacias), a busca vai ao
 * GeoServer. As duas ignoram acentos e maiúsculas ("para" acha o Pará).
 */
export function EscolhaValor({
  geoserver,
  dimensao,
  nomes,
  opcoes,
  chave,
  rotulo,
  onEscolher,
}: {
  geoserver: GeoServerApi;
  dimensao: string;
  nomes: NomeDimensao;
  opcoes: readonly ValorRanking[];
  chave: string | undefined;
  rotulo: string | undefined;
  onEscolher: (chave: string | undefined) => void;
}) {
  const [consulta, setConsulta] = useState("");
  const remoto = opcoes.length > LIMITE_DA_LISTA_INTEIRA;
  const busca = useBuscaDeLugar(geoserver, dimensao, consulta, remoto);
  const procurado = termoDeBusca(consulta);
  // A busca remota já vem filtrada pelo termo, no GeoServer; a lista do ranking, filtra-se aqui.
  const candidatos = remoto
    ? unicos(dimensao, busca.data ?? [])
    : unicos(dimensao, opcoes).filter((o) => temOTermo(o.rotulo, procurado));
  const { outro } = palavrasDoGenero(nomes);
  return (
    <AutocompleteDominio
      carregando={busca.isFetching}
      consulta={consulta}
      id="valor-dimensao"
      maisResultados={remoto && (busca.data?.length ?? 0) >= LIMITE_DA_BUSCA}
      // Tirar o lugar volta à lista, para escolher outro.
      nomeDoRemover={(escolhido) => `Tirar ${escolhido} e escolher ${outro} ${nomes.singular}`}
      onChange={onEscolher}
      onConsultaChange={setConsulta}
      opcoes={candidatos.map((o) => ({
        valor: o.chave,
        rotulo: o.rotulo,
        detalhe: o.area_ha === undefined ? undefined : formatarHectaresResumido(o.area_ha),
      }))}
      placeholder={remoto ? "Digite o nome…" : "Escolha ou digite…"}
      valor={chave}
      valorRotulo={rotulo}
    />
  );
}
