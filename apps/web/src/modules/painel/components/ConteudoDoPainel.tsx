import { LoadingState } from "@sinaveg/ui";

import type { Resumo } from "@/modules/filtros";
import type { GeoServerApi } from "@/shared/api/geoserver";
import { ErroCarregamento } from "@/shared/components/ErroCarregamento";
import type { Catalogo } from "@/shared/services/catalogo.service";
import { formatarHectaresResumido, formatarParte } from "@/shared/utils/formatos";
import { progressoDasMetas } from "@/shared/utils/metas";

import type { DadosDoPainel } from "../hooks/usePainel";
import type { AlteracaoPainel } from "../types";
import { metasVisiveis } from "../utils/metas";
import { Assuntos } from "./assuntos/Assuntos";
import { IndicadoresDoPainel } from "./indicadores/IndicadoresDoPainel";
import { RankingDoLugar } from "./RankingDoLugar";

type PropsDoConteudo = {
  geoserver: GeoServerApi;
  catalogo: Catalogo;
  painel: DadosDoPainel;
  onEstadoChange: (alteracao: AlteracaoPainel) => void;
};

/**
 * Os números do painel: os indicadores no topo e, embaixo, os cartões por assunto ou, enquanto
 * a pessoa escolhe um lugar, a lista de todos eles com a área de cada um.
 */
export function ConteudoDoPainel({ geoserver, catalogo, painel, onEstadoChange }: PropsDoConteudo) {
  return (
    <div className="mt-8 space-y-8">
      {painel.erro === null ? null : (
        <ErroCarregamento>
          Não foi possível ler os quantitativos: {painel.erro.message}
        </ErroCarregamento>
      )}
      {painel.carregando && painel.erro === null ? (
        <LoadingState>Somando as áreas…</LoadingState>
      ) : null}
      {painel.carregando || painel.atual === undefined ? null : (
        <NumerosDoPainel
          atual={painel.atual}
          catalogo={catalogo}
          geoserver={geoserver}
          onEstadoChange={onEstadoChange}
          painel={painel}
        />
      )}
    </div>
  );
}

/** Os números somados: os indicadores e, embaixo, a lista dos lugares ou os assuntos. */
function NumerosDoPainel({
  geoserver,
  catalogo,
  painel,
  atual,
  onEstadoChange,
}: PropsDoConteudo & { atual: Resumo }) {
  const { semFiltro, dimensao, nomes, chave, brasil, filtrando, contexto } = painel;
  const metas = metasVisiveis(brasil ? undefined : dimensao?.dimensao, filtrando);
  return (
    <>
      <IndicadoresDoPainel
        atual={atual}
        metas={metas ? progressoDasMetas(catalogo.arranjos, atual.porArranjo) : undefined}
        niveis={catalogo.niveis}
        filtro={
          semFiltro === undefined
            ? undefined
            : `Só as áreas filtradas: ${formatarParte(atual.total.area, semFiltro.total.area)} dos ${formatarHectaresResumido(semFiltro.total.area)}.`
        }
      />
      {dimensao !== undefined && nomes !== undefined && chave === undefined ? (
        <RankingDoLugar
          atual={atual}
          contexto={contexto}
          dimensao={dimensao.dimensao}
          filtrando={filtrando}
          nomes={nomes}
          onSelecionar={(valor) => onEstadoChange({ chave: valor })}
          ranking={painel.ranking}
        />
      ) : (
        <Assuntos
          atual={atual}
          catalogo={catalogo}
          contexto={contexto}
          dimensao={brasil ? undefined : dimensao?.dimensao}
          filtrando={filtrando}
          geoserver={geoserver}
          metas={metas}
          onEstadoChange={onEstadoChange}
        />
      )}
    </>
  );
}
