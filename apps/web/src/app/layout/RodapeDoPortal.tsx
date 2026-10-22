import { Link, useRouteContext } from "@tanstack/react-router";

import { SiteFooter } from "@sinaveg/ui";

import { NAVEGACAO_PORTAL } from "./nav-items";

/** O rodapé: as seções do portal, os dados abertos, o institucional e a transparência. */
export function RodapeDoPortal() {
  // Só o GeoServer: o contexto inteiro é outro objeto a cada navegação, e o rodapé seria refeito.
  const geoserver = useRouteContext({ from: "__root__", select: (contexto) => contexto.geoserver });
  return (
    <SiteFooter
      columns={[
        {
          key: "portal",
          title: "Portal",
          items: NAVEGACAO_PORTAL.map((item) => ({
            key: item.to,
            node: (
              <Link className="hover:text-white" to={item.to}>
                {item.label}
              </Link>
            ),
          })),
        },
        {
          key: "dados",
          title: "Dados abertos",
          items: [
            {
              key: "baixar",
              node: (
                <Link className="hover:text-white" search={{ secao: "downloads" }} to="/dados">
                  Downloads
                </Link>
              ),
            },
            {
              key: "servicos",
              node: (
                <Link className="hover:text-white" search={{ secao: "servicos" }} to="/dados">
                  Serviços Web (WMS e WFS)
                </Link>
              ),
            },
            {
              key: "wms",
              node: (
                <a
                  className="hover:text-white"
                  href={`${geoserver.urlWms}?service=WMS&request=GetCapabilities`}
                >
                  Capacidades WMS
                </a>
              ),
            },
            {
              key: "wfs",
              node: (
                <a
                  className="hover:text-white"
                  href={`${geoserver.urlOws}?service=WFS&request=GetCapabilities`}
                >
                  Capacidades WFS
                </a>
              ),
            },
          ],
        },
        {
          key: "institucional",
          title: "Institucional",
          items: [
            { key: "mma", node: <span>Ministério do Meio Ambiente e Mudança do Clima</span> },
            { key: "conaveg", node: <span>Planaveg · Conaveg</span> },
          ],
        },
        {
          key: "transparencia",
          title: "Transparência",
          items: [
            {
              key: "metodologia",
              node: (
                <Link className="hover:text-white" search={{ secao: "metadados" }} to="/dados">
                  Como os números são calculados
                </Link>
              ),
            },
          ],
        },
      ]}
    >
      <span>Dados públicos servidos pelo GeoServer do planaveg_core (WMS e WFS).</span>
      <span>SINAVEG · Planaveg</span>
    </SiteFooter>
  );
}
