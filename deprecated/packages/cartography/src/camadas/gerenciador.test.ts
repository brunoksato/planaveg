// @vitest-environment jsdom
import L from "leaflet";
import { afterEach, describe, expect, it } from "vitest";

import type { CamadaMapa } from "../tipos";
import { criarGerenciadorDeCamadas } from "./gerenciador";

const tiles = (id: string, versao = "1"): CamadaMapa => ({
  id,
  tipo: "tiles",
  url: `https://tiles.test/${id}/{z}/{y}/{x}.png?v=${versao}`,
});

/** O contorno do município, desenhado na hora pelo WMS, com o filtro dele. */
const contorno = (cql?: string): CamadaMapa => ({
  id: "municipio",
  tipo: "wms",
  nome: "planaveg:municipio",
  ...(cql === undefined ? {} : { cql }),
});

// O mapa do teste em curso, desmontado no fim de cada um.
let aberto: L.Map | undefined;
afterEach(() => {
  aberto?.remove();
  aberto = undefined;
});

function contarCamadas(mapa: L.Map): number {
  return camadasNoMapa(mapa).length;
}

function camadasNoMapa(mapa: L.Map): L.Layer[] {
  const camadas: L.Layer[] = [];
  mapa.eachLayer((camada) => {
    camadas.push(camada);
  });
  return camadas;
}

function criarMapa(): L.Map {
  const elemento = document.createElement("div");
  document.body.append(elemento);
  aberto = L.map(elemento, { center: [-14.5, -54], zoom: 4 });
  return aberto;
}

describe("gerenciador de camadas", () => {
  it("põe no mapa só as camadas pedidas e tira as que saem do pedido", () => {
    const mapa = criarMapa();
    const camadas = criarGerenciadorDeCamadas(mapa, () => ({}));

    camadas.sincronizar([tiles("a"), tiles("b")], "https://geo.test/wms");
    expect(contarCamadas(mapa)).toBe(2);

    camadas.sincronizar([tiles("a")], "https://geo.test/wms");
    expect(contarCamadas(mapa)).toBe(1);
  });

  it("uma camada tirada não reage mais ao mapa (mover a vista não a chama)", () => {
    const mapa = criarMapa();
    const camadas = criarGerenciadorDeCamadas(mapa, () => ({}));
    camadas.sincronizar([tiles("a"), tiles("b")], "https://geo.test/wms");
    camadas.sincronizar([tiles("a")], "https://geo.test/wms");

    // Antes, a camada tirada continuava ouvindo o `viewreset` e quebrava sem mapa.
    expect(() => mapa.setView([-10, -50], 6, { animate: false })).not.toThrow();
  });

  it("troca o filtro do WMS na mesma camada, e só recria quando o filtro some", () => {
    const mapa = criarMapa();
    const camadas = criarGerenciadorDeCamadas(mapa, () => ({}));
    camadas.sincronizar([contorno("cod_municipio = '1'")], "https://geo.test/wms");
    const [primeira] = camadasNoMapa(mapa) as L.TileLayer.WMS[];

    // Outro município: o mesmo objeto do Leaflet, com o filtro novo (`setParams`).
    camadas.sincronizar([contorno("cod_municipio = '2'")], "https://geo.test/wms");
    const [depois] = camadasNoMapa(mapa) as L.TileLayer.WMS[];
    expect(depois).toBe(primeira);
    expect(depois?.wmsParams).toMatchObject({ CQL_FILTER: "cod_municipio = '2'" });

    // `setParams` não tira parâmetros: sem filtro, a camada é outra, sem `CQL_FILTER` (a
    // anterior fica até ela carregar).
    camadas.sincronizar([contorno()], "https://geo.test/wms");
    const semFiltro = (camadasNoMapa(mapa) as L.TileLayer.WMS[]).find((c) => c !== primeira);
    expect(semFiltro).toBeDefined();
    expect(semFiltro?.wmsParams).not.toHaveProperty("CQL_FILTER");
  });

  it("troca sem piscar: a camada anterior fica até a nova carregar", () => {
    const mapa = criarMapa();
    const camadas = criarGerenciadorDeCamadas(mapa, () => ({}));
    camadas.sincronizar([tiles("a", "1")], "https://geo.test/wms");
    const [antiga] = camadasNoMapa(mapa);

    // Outra URL (um ano, um filtro): a nova entra, e a antiga continua até a nova carregar.
    camadas.sincronizar([tiles("a", "2")], "https://geo.test/wms");
    const nova = camadasNoMapa(mapa).find((camada) => camada !== antiga);
    expect(contarCamadas(mapa)).toBe(2);
    expect(nova).toBeDefined();

    nova?.fire("load");
    expect(camadasNoMapa(mapa)).toEqual([nova]);
  });

  it("numa terceira troca antes de a segunda carregar, tira de vez a mais antiga", () => {
    const mapa = criarMapa();
    const camadas = criarGerenciadorDeCamadas(mapa, () => ({}));
    camadas.sincronizar([tiles("a", "1")], "https://geo.test/wms");
    const [primeira] = camadasNoMapa(mapa);
    camadas.sincronizar([tiles("a", "2")], "https://geo.test/wms");
    const segunda = camadasNoMapa(mapa).find((camada) => camada !== primeira);

    camadas.sincronizar([tiles("a", "3")], "https://geo.test/wms");

    // Ficam a terceira e a segunda (que ainda está saindo); a primeira já saiu.
    expect(contarCamadas(mapa)).toBe(2);
    expect(camadasNoMapa(mapa)).not.toContain(primeira);
    expect(camadasNoMapa(mapa)).toContain(segunda);
  });
});
