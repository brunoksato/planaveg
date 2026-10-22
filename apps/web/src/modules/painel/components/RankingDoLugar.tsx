import type { Resumo } from "@/modules/filtros";
import { nomeLugar, type NomeDimensao, todosOsPlural } from "@/shared/utils/glossario";

import type { ValorRanking } from "../services/lugar.service";
import type { ContextoCsv } from "../types";
import { comArea, comoRanking, notaDaLista } from "../utils/assuntos";
import { semAcento, tabelaCsv } from "../utils/csv";
import { SecaoRanking } from "./assuntos/SecaoRanking";

/**
 * Escolhendo um lugar: a lista de todos, com a área de cada um. Estados e biomas seguem os
 * filtros (as facetas do Brasil os têm); os outros recortes mostram a área total, sem eles. O CSV
 * é a lista como está na tela: os lugares do ano, com a área e os polígonos de cada um.
 */
export function RankingDoLugar({
  dimensao,
  nomes,
  atual,
  ranking,
  filtrando,
  contexto,
  onSelecionar,
}: {
  dimensao: string;
  nomes: NomeDimensao;
  atual: Resumo;
  ranking: readonly ValorRanking[] | undefined;
  filtrando: boolean;
  contexto: ContextoCsv;
  onSelecionar: (chave: string) => void;
}) {
  const { ano } = contexto;
  const porValor = dimensao === "uf" ? atual.porUf : dimensao === "bioma" ? atual.porBioma : null;
  // Com filtro, estados e biomas saem das facetas do Brasil, filtradas; o resto vem do GeoServer,
  // com a área total de cada lugar.
  const filtrada = filtrando && porValor !== null;
  const valores: readonly ValorRanking[] | undefined = filtrada
    ? comoRanking(comArea(porValor))
    : ranking;
  return (
    <SecaoRanking
      csv={
        valores === undefined
          ? undefined
          : tabelaCsv(
              `Baixar os dados de ${todosOsPlural(nomes)} (CSV)`,
              `painel-${semAcento(nomes.plural)}-${filtrada ? contexto.arquivo : "brasil"}-${ano}`,
              ["ano", "filtros", dimensao, "nome", "area_ha", "poligonos"],
              valores
                .filter((v) => v.chave !== null)
                .map((v) => [
                  ano,
                  // Sem filtro na lista (ou com a área total, sem eles), a coluna fica vazia.
                  filtrada ? contexto.filtros : "",
                  v.chave,
                  nomeLugar(dimensao, v.chave, v.rotulo),
                  v.area_ha,
                  v.n_poligonos,
                ]),
            )
      }
      dimensao={dimensao}
      id="ranking"
      nomes={nomes}
      nota={notaDaLista(dimensao, nomes, filtrando && !filtrada)}
      onSelecionar={onSelecionar}
      valores={valores}
    />
  );
}
