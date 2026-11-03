import { LoadingState } from "@sinaveg/ui";

import type { GeoServerApi } from "@/shared/api/geoserver";
import { ErroCarregamento } from "@/shared/components/ErroCarregamento";

import { CaminhosDoPortal } from "./components/CaminhosDoPortal";
import { Destaque } from "./components/Destaque";
import { TiposDeArea } from "./components/TiposDeArea";
import { useVisaoGeral } from "./hooks/useVisaoGeral";

/**
 * Página inicial: o que é o SINAVEG, quanto já se atingiu da meta nacional (com a parte de cada
 * arranjo), os caminhos para o mapa, o painel e o acesso aos dados, e em que tipo de área está a
 * vegetação. Os números são os da base mais recente, sem ano à vista: o SINAVEG não compara os
 * anos. Sem texto explicativo, como a revisão do MMA pede: de onde vêm os números e o que é uma
 * estimativa técnica ficam nos Metadados.
 */
export function VisaoGeralScreen({ geoserver }: { geoserver: GeoServerApi }) {
  const { catalogo, porNivel, porArranjo, erro, carregando } = useVisaoGeral(geoserver);
  return (
    <div className="mx-auto w-full max-w-6xl space-y-12 pb-8 lg:pt-2">
      <header className="max-w-3xl">
        <p className="text-sm font-semibold text-primary">Planaveg · SINAVEG</p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
          Recuperação da vegetação nativa no Brasil
        </h1>
        <p className="mt-5 text-lg text-muted-foreground">
          O SINAVEG foi desenhado como uma estrutura integrada e adaptável, capaz de consolidar
          dados de diferentes fontes para apoiar o reporte da meta de recuperação da vegetação do
          Planaveg.
        </p>
      </header>

      {erro === null ? null : (
        <ErroCarregamento>Não foi possível ler o GeoServer: {erro.message}</ErroCarregamento>
      )}
      {erro === null && carregando ? <LoadingState>Carregando os números…</LoadingState> : null}
      {catalogo === undefined || porArranjo === undefined ? null : (
        <Destaque arranjos={catalogo.arranjos} porArranjo={porArranjo} />
      )}

      <CaminhosDoPortal />

      {catalogo === undefined || porNivel.size === 0 ? null : (
        <TiposDeArea catalogoNiveis={catalogo.niveis} porNivel={porNivel} />
      )}
    </div>
  );
}
