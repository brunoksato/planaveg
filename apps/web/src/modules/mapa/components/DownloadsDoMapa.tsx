import { Link } from "@tanstack/react-router";
import { BarChart3, Download } from "lucide-react";

import type { GeoServerApi } from "@/shared/api/geoserver";
import { LINK_LATERAL } from "@/shared/components/lateral/classes";

import type { EstadoDoMapa } from "../hooks/useEstadoDoMapa";
import { ATRIBUTOS_CSV } from "../utils/constantes";
import { comMunicipio } from "../utils/cql";
import { buscaDoPainel } from "../utils/painel";

/**
 * Os downloads do que o mapa mostra (as áreas filtradas e as do município) e o link para os
 * mesmos números no painel. Sem nenhum tipo de área marcado, não há áreas para baixar.
 */
export function DownloadsDoMapa({
  geoserver,
  estado,
  municipio,
}: {
  geoserver: GeoServerApi;
  estado: EstadoDoMapa;
  municipio: string | undefined;
}) {
  const { cql, nomeCamadaPecas, noMapa, filtrado } = estado;
  const temAreas = noMapa.length > 0;
  return (
    <>
      {temAreas && filtrado ? (
        <a
          className={LINK_LATERAL}
          download
          href={geoserver.urlDownload(nomeCamadaPecas, "csv", {
            cql,
            propriedades: ATRIBUTOS_CSV,
          })}
        >
          <Download aria-hidden />
          Baixar as áreas filtradas (CSV)
        </a>
      ) : null}
      {temAreas && municipio !== undefined ? (
        <a
          className={LINK_LATERAL}
          download
          href={geoserver.urlDownload(nomeCamadaPecas, "csv", {
            cql: comMunicipio(cql, municipio),
            propriedades: ATRIBUTOS_CSV,
          })}
        >
          <Download aria-hidden />
          Baixar as áreas do município (CSV)
        </a>
      ) : null}
      <Link
        className={LINK_LATERAL}
        search={buscaDoPainel(municipio, estado.filtrosDasAreas)}
        to="/painel"
      >
        <BarChart3 aria-hidden />
        Ver os números no painel
      </Link>
    </>
  );
}
