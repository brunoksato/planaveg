import { ArrowLeft } from "lucide-react";
import { useRef } from "react";

import { LoadingState } from "@sinaveg/ui";

import type { GeoServerApi } from "@/shared/api/geoserver";
import { ErroCarregamento } from "@/shared/components/ErroCarregamento";
import { useCatalogo } from "@/shared/services/catalogo.queries";

import { IndiceDasSecoes } from "./components/IndiceDasSecoes";
import { PartesDoAcesso } from "./components/PartesDoAcesso";
import { VisaoBaixar } from "./components/VisaoBaixar";
import { VisaoCamadas } from "./components/VisaoCamadas";
import { VisaoFiltros } from "./components/VisaoFiltros";
import { VisaoFontesAusentes } from "./components/VisaoFontesAusentes";
import { VisaoMetodologia } from "./components/VisaoMetodologia";
import { VisaoServicos } from "./components/VisaoServicos";
import { VisaoSobreABase } from "./components/VisaoSobreABase";
import { SECOES, type SecaoDados } from "./utils/secoes";

/**
 * Acesso aos dados, como no TerraBrasilis (revisão da MMA de 16/10/2026): sem parte escolhida, um
 * cartão para cada uma (downloads, metadados e serviços web); com uma escolhida (na URL), o que
 * ela tem, uma seção depois da outra.
 */
export function DadosScreen({
  geoserver,
  secao,
  onSecaoChange,
}: {
  geoserver: GeoServerApi;
  secao?: SecaoDados | undefined;
  onSecaoChange: (secao: SecaoDados | undefined) => void;
}) {
  const catalogo = useCatalogo(geoserver);
  const topo = useRef<HTMLDivElement>(null);
  function mudarSecao(proxima: SecaoDados | undefined): void {
    onSecaoChange(proxima);
    requestAnimationFrame(() => {
      topo.current?.scrollIntoView?.({ behavior: "instant", block: "start" });
    });
  }
  if (catalogo.isPending) return <LoadingState>Carregando o catálogo…</LoadingState>;
  if (catalogo.isError) {
    return (
      <ErroCarregamento>
        Não foi possível ler o catálogo do GeoServer: {catalogo.error.message}
      </ErroCarregamento>
    );
  }
  const dados = catalogo.data;
  const parte = SECOES.find((item) => item.id === secao);
  return (
    <div className="mx-auto w-full max-w-6xl pb-8 lg:pt-2">
      <div className="scroll-mt-6" ref={topo} />
      <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
        Acesso aos dados
      </h1>
      {parte === undefined ? (
        <div className="mt-8">
          <PartesDoAcesso onEscolher={mudarSecao} />
        </div>
      ) : (
        <>
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
            <button
              className="inline-flex items-center gap-1.5 text-[15px] font-medium text-primary hover:underline"
              onClick={() => mudarSecao(undefined)}
              type="button"
            >
              <ArrowLeft aria-hidden className="size-4" />
              Todas as partes
            </button>
            <IndiceDasSecoes onEscolher={mudarSecao} secao={parte.id} />
          </div>
          <h2 className="mt-8 text-2xl font-semibold tracking-tight text-balance">
            {parte.rotulo}
          </h2>
          <p className="mt-2 max-w-3xl text-lg text-muted-foreground">{parte.resumo}</p>
          <div className="mt-8 space-y-6">
            {parte.id === "downloads" ? (
              <>
                <VisaoBaixar dados={dados} geoserver={geoserver} />
                <VisaoCamadas dados={dados} geoserver={geoserver} />
              </>
            ) : null}
            {parte.id === "metadados" ? (
              <>
                <VisaoSobreABase dados={dados} />
                <VisaoMetodologia dados={dados} />
                <VisaoFiltros dados={dados} />
                <VisaoFontesAusentes dados={dados} />
              </>
            ) : null}
            {parte.id === "servicos" ? <VisaoServicos geoserver={geoserver} /> : null}
          </div>
        </>
      )}
    </div>
  );
}
