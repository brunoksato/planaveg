import type { Resumo } from "@/modules/filtros";
import type { GeoServerApi } from "@/shared/api/geoserver";
import type { Catalogo } from "@/shared/services/catalogo.service";
import { nomeDimensao, nomeLugar } from "@/shared/utils/glossario";

import type { ContextoCsv, MudarLugar } from "../../types";
import { comArea, comoRanking, participacao, seDivide } from "../../utils/assuntos";
import { ESTADOS_INICIAIS } from "../../utils/constantes";
import { csvDoPainel } from "../../utils/csv";
import { SecaoArranjos } from "./SecaoArranjos";
import { SecaoBacias } from "./SecaoBacias";
import { SecaoBiomas } from "./SecaoBiomas";
import { SecaoImoveisRurais } from "./SecaoImoveisRurais";
import { SecaoProcessos } from "./SecaoProcessos";
import { SecaoRanking } from "./SecaoRanking";
import { SecaoTipos } from "./SecaoTipos";
import { SecaoUcs } from "./SecaoUcs";

/**
 * Os cartões do painel, numa grade: cada um com um título curto, o número principal e o
 * gráfico; a tabela com os números exatos e o CSV ficam no rodapé. Tudo sai do resumo das
 * facetas do lugar, só das áreas que atendem os filtros, menos as bacias (veja `SecaoBacias`).
 */

/** Os cartões do Brasil inteiro ou de um lugar, numa grade de duas colunas na tela larga. */
export function Assuntos({
  catalogo,
  atual,
  dimensao,
  contexto,
  metas,
  filtrando,
  geoserver,
  onEstadoChange,
}: {
  /** Para o cartão das bacias, que lê a área de cada uma no nível escolhido. */
  geoserver: GeoServerApi;
  catalogo: Catalogo;
  atual: Resumo;
  /** O tipo do lugar; `undefined` = Brasil inteiro, onde um estado da lista abre o painel dele. */
  dimensao: string | undefined;
  contexto: ContextoCsv;
  /** O progresso das metas nacionais (Brasil inteiro, sem filtros). */
  metas: boolean;
  filtrando: boolean;
  onEstadoChange: MudarLugar;
}) {
  const brasil = dimensao === undefined;
  const biomas = comArea(atual.porBioma);
  const estados = comArea(atual.porUf);
  // Um estado ou município está num estado só, e um bioma é um bioma: essas listas só valem
  // onde a área se divide de verdade (uma lasca de borda não conta).
  const mostrarBiomas = dimensao !== "bioma" && seDivide(biomas, atual.total.area);
  const mostrarEstados =
    dimensao !== "uf" && dimensao !== "municipio" && seDivide(estados, atual.total.area);
  const nomesEstado = nomeDimensao("uf", "Estado");
  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <SecaoArranjos arranjos={catalogo.arranjos} atual={atual} contexto={contexto} metas={metas} />
      <SecaoTipos atual={atual} contexto={contexto} niveis={catalogo.niveis} />
      <SecaoProcessos atual={atual} contexto={contexto} />
      <SecaoImoveisRurais atual={atual} contexto={contexto} niveis={catalogo.niveis} />
      {atual.ucs.area > 0 ? <SecaoUcs atual={atual} contexto={contexto} /> : null}
      {mostrarBiomas ? (
        <SecaoBiomas biomas={biomas} contexto={contexto} total={atual.total.area} />
      ) : null}
      {mostrarEstados ? (
        <SecaoRanking
          csv={csvDoPainel(
            contexto,
            "estados",
            "Baixar os dados por estado (CSV)",
            ["uf", "nome", "area_ha", "poligonos", "do_total"],
            estados.map(([uf, t]) => [
              uf,
              nomeLugar("uf", uf, uf),
              t.area,
              t.poligonos,
              participacao(t.area, atual.total.area),
            ]),
          )}
          dimensao="uf"
          explicacao={brasil ? undefined : "A área de cada estado neste lugar."}
          id="estados"
          inicial={ESTADOS_INICIAIS}
          nomes={nomesEstado}
          onSelecionar={
            brasil ? (valor) => onEstadoChange({ dimensao: "uf", chave: valor }) : undefined
          }
          valores={comoRanking(estados)}
        />
      ) : null}
      {brasil ? (
        <SecaoBacias
          catalogo={catalogo}
          contexto={contexto}
          filtrando={filtrando}
          geoserver={geoserver}
          onEstadoChange={onEstadoChange}
        />
      ) : null}
    </div>
  );
}
