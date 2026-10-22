import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect, useImperativeHandle, useLayoutEffect, useRef } from "react";

import { criarGerenciadorDeCamadas, type GerenciadorDeCamadas } from "./camadas/gerenciador";
import { consultaDoClique } from "./consulta-clique";
import { desenharDestaque } from "./destaque";
import { colocarMapaBase } from "./mapas-base";
import type { MapaWmsProps, Vista } from "./tipos";

/**
 * Brasil inteiro, de Roraima ao Chuí e do Acre a Fernando de Noronha: a vista inicial quando o
 * portal não pede outra. O mapa se ajusta a esses limites em meio zoom (`zoomSnap`), para o
 * país encher a tela sem mostrar o Atlântico até a África nem cortar as pontas.
 */
const LIMITES_BRASIL: L.LatLngBoundsExpression = [
  [-33.75, -73.99],
  [5.27, -32.39],
];

/**
 * Mapa do portal sobre o GeoServer do planaveg_core: mapa base e camadas em tiles. As camadas
 * temáticas (peças por ano e estilo, com ou sem filtro) vêm do cache do GeoServer por WMTS; só o
 * contorno do município é desenhado na hora por WMS. O componente não conhece os dados: recebe
 * URLs, nomes, filtros e opacidades, e devolve a vista e os cliques para o portal consultar o
 * `GetFeatureInfo`.
 */
export function MapaWms({
  urlWms,
  camadas,
  mapaBase,
  vista,
  destaque,
  onVista,
  onClique,
  onCarregando,
  onErroCamada,
  className,
  ref,
}: MapaWmsProps) {
  const elemento = useRef<HTMLDivElement>(null);
  const mapaAtual = useRef<L.Map | null>(null);
  const gerenciador = useRef<GerenciadorDeCamadas | null>(null);
  const vistaInicial = useRef<Vista | undefined>(vista);
  const retornos = useRef({ onVista, onClique, onCarregando, onErroCamada });
  // Os eventos do Leaflet leem sempre os retornos mais novos, sem recriar o mapa.
  useLayoutEffect(() => {
    retornos.current = { onVista, onClique, onCarregando, onErroCamada };
  });

  useEffect(() => {
    if (elemento.current === null) return;
    const inicial = vistaInicial.current;
    const mapa = L.map(elemento.current, {
      zoomControl: false,
      minZoom: 3,
      maxZoom: 18,
      zoomSnap: 0.5,
      worldCopyJump: true,
    });
    if (inicial === undefined) mapa.fitBounds(LIMITES_BRASIL);
    else mapa.setView([inicial.latitude, inicial.longitude], inicial.zoom);
    L.control.scale({ imperial: false, position: "bottomleft" }).addTo(mapa);
    const camadasDoMapa = criarGerenciadorDeCamadas(mapa, () => retornos.current);
    const aoMover = () => {
      const centro = mapa.getCenter();
      retornos.current.onVista?.({
        longitude: arredondar(centro.lng, 5),
        latitude: arredondar(centro.lat, 5),
        zoom: mapa.getZoom(),
      });
    };
    const aoClicar = (evento: L.LeafletMouseEvent) => {
      retornos.current.onClique?.({
        consulta: consultaDoClique(mapa, mapa.options.crs ?? L.CRS.EPSG3857, evento.containerPoint),
      });
    };
    mapa.on("moveend", aoMover);
    mapa.on("click", aoClicar);
    mapaAtual.current = mapa;
    gerenciador.current = camadasDoMapa;
    // O contêiner muda de tamanho (a lateral recolhida, a janela): o Leaflet refaz as contas.
    const observador =
      typeof ResizeObserver === "undefined"
        ? undefined
        : new ResizeObserver(() => mapa.invalidateSize());
    observador?.observe(elemento.current);
    return () => {
      observador?.disconnect();
      mapa.off("moveend", aoMover);
      mapa.off("click", aoClicar);
      camadasDoMapa.destruir();
      gerenciador.current = null;
      mapaAtual.current = null;
      mapa.remove();
    };
  }, []);

  useEffect(() => {
    const mapa = mapaAtual.current;
    if (mapa === null) return;
    return colocarMapaBase(mapa, mapaBase);
  }, [mapaBase]);

  useEffect(() => {
    gerenciador.current?.sincronizar(camadas, urlWms);
  }, [camadas, urlWms]);

  useEffect(() => {
    const mapa = mapaAtual.current;
    if (mapa === null || destaque === null || destaque === undefined) return;
    return desenharDestaque(mapa, destaque);
  }, [destaque]);

  useImperativeHandle(
    ref,
    () => ({
      ajustarAosLimites: ([oeste, sul, leste, norte]) => {
        mapaAtual.current?.fitBounds(
          [
            [sul, oeste],
            [norte, leste],
          ],
          { padding: [24, 24], maxZoom: 14 },
        );
      },
      redefinirVista: () => {
        mapaAtual.current?.fitBounds(LIMITES_BRASIL);
      },
      aproximar: () => mapaAtual.current?.zoomIn(),
      afastar: () => mapaAtual.current?.zoomOut(),
    }),
    [],
  );

  return (
    <div className={`${className ?? "h-full w-full"} overflow-hidden`}>
      <div
        aria-label="Mapa interativo"
        className="absolute inset-0"
        ref={elemento}
        role="application"
      />
    </div>
  );
}

function arredondar(valor: number, casas: number): number {
  const fator = 10 ** casas;
  return Math.round(valor * fator) / fator;
}
