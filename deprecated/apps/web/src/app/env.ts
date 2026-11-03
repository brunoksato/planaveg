/**
 * GeoServer do planaveg_core: a única fonte de dados do portal (tiles e WMS para o mapa, WFS para
 * o resto). O padrão local é 127.0.0.1, não `localhost`: o navegador tenta IPv6 (`::1`) primeiro, e
 * o encaminhamento IPv6 do Docker local deixou cada tile de 2 a 10 vezes mais lento e irregular.
 * Em produção o GeoServer fica no mesmo domínio do portal (`VITE_GEOSERVER_URL=/geoserver`).
 */
export const geoserverUrl: string = enderecoCompleto(
  import.meta.env.VITE_GEOSERVER_URL ?? "http://127.0.0.1:8085/geoserver",
  window.location.origin,
);

export const geoserverWorkspace: string = import.meta.env.VITE_GEOSERVER_WORKSPACE ?? "planaveg";

/**
 * Um caminho (`/geoserver`) vira endereço completo na origem do portal: os endereços mostrados
 * para o QGIS precisam servir fora do navegador. Sem a barra final.
 */
function enderecoCompleto(url: string, origem: string): string {
  const semBarra = url.replace(/\/+$/, "");
  return semBarra.startsWith("/") ? `${origem}${semBarra}` : semBarra;
}
