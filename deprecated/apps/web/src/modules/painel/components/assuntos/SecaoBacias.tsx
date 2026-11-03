import { useState } from "react";

import type { GeoServerApi } from "@/shared/api/geoserver";
import { Segmentado } from "@/shared/components/Segmentado";
import type { Catalogo } from "@/shared/services/catalogo.service";
import { NIVEIS_DE_BACIA, nomeDimensao, nomeLugar } from "@/shared/utils/glossario";

import { useRanking } from "../../services/lugar.queries";
import type { ContextoCsv, MudarLugar } from "../../types";
import { notaDaLista, participacao } from "../../utils/assuntos";
import { BACIAS_INICIAIS, REGIOES_INICIAIS } from "../../utils/constantes";
import { semAcento, tabelaCsv } from "../../utils/csv";
import { SecaoRanking } from "./SecaoRanking";

/**
 * As bacias com mais área no Brasil inteiro, num dos três níveis: região hidrográfica, mesobacia
 * ou bacia, do maior ao menor, com a troca de nível no cartão. A área de cada uma vem pronta do
 * GeoServer, sem os filtros: as facetas do Brasil não têm as bacias. Do contexto, só o ano: o CSV
 * é o do Brasil, sem filtros.
 */
export function SecaoBacias({
  geoserver,
  catalogo,
  contexto,
  filtrando,
  onEstadoChange,
}: {
  geoserver: GeoServerApi;
  catalogo: Catalogo;
  contexto: ContextoCsv;
  filtrando: boolean;
  onEstadoChange: MudarLugar;
}) {
  const { ano } = contexto;
  // Só os níveis que o catálogo tem; o cartão abre no maior.
  const niveis = NIVEIS_DE_BACIA.filter((n) =>
    catalogo.dimensoes.some((d) => d.dimensao === n.dimensao),
  );
  const [escolhido, setEscolhido] = useState<string | undefined>(niveis[0]?.dimensao);
  const dimensao = catalogo.dimensoes.find((d) => d.dimensao === escolhido);
  const bacias = useRanking(geoserver, escolhido ?? "", dimensao === undefined ? undefined : ano);
  if (dimensao === undefined) return null;
  const nomes = nomeDimensao(dimensao.dimensao, dimensao.titulo);
  const valores = bacias.data;
  const total = (valores ?? []).reduce((soma, v) => soma + v.area_ha, 0);
  return (
    <SecaoRanking
      controle={
        niveis.length < 2 ? undefined : (
          <Segmentado
            compacto
            legenda="Nível, do maior ao menor"
            onChange={setEscolhido}
            opcoes={niveis.map((n) => ({ valor: n.dimensao, rotulo: n.nome }))}
            valor={dimensao.dimensao}
          />
        )
      }
      csv={
        valores === undefined
          ? undefined
          : tabelaCsv(
              `Baixar os dados por ${nomes.singular} (CSV)`,
              `painel-${semAcento(nomes.plural)}-brasil-${ano}`,
              ["ano", dimensao.dimensao, "nome", "area_ha", "poligonos", "do_total"],
              valores
                .filter((b) => b.chave !== null)
                .map((b) => [
                  ano,
                  b.chave,
                  nomeLugar(dimensao.dimensao, b.chave, b.rotulo),
                  b.area_ha,
                  b.n_poligonos,
                  participacao(b.area_ha, total),
                ]),
            )
      }
      dimensao={dimensao.dimensao}
      id="bacias"
      inicial={dimensao.dimensao === "regiao_hidrografica" ? REGIOES_INICIAIS : BACIAS_INICIAIS}
      nomes={nomes}
      nota={notaDaLista(dimensao.dimensao, nomes, filtrando)}
      onSelecionar={(valor) => onEstadoChange({ dimensao: dimensao.dimensao, chave: valor })}
      onVerTodos={() => onEstadoChange({ dimensao: dimensao.dimensao, chave: undefined })}
      valores={valores}
    />
  );
}
