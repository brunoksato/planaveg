import { NativeSelect } from "@sinaveg/ui";

import type { GeoServerApi } from "@/shared/api/geoserver";
import type { Catalogo } from "@/shared/services/catalogo.service";
import {
  NIVEIS_DE_BACIA,
  nomeDimensao,
  type NomeDimensao,
  NOTA_DO_NOME_DA_BACIA,
} from "@/shared/utils/glossario";

import type { ValorRanking } from "../services/lugar.service";
import type { AlteracaoPainel } from "../types";
import { EscolhaValor } from "./EscolhaValor";

/** Os níveis das bacias, que "Mostrar dados de" junta num grupo. */
const CODIGOS_DE_BACIA: ReadonlySet<string> = new Set(NIVEIS_DE_BACIA.map((n) => n.dimensao));

/**
 * "Mostrar dados de": o tipo de lugar (o Brasil inteiro, um estado, um município, uma bacia…) e,
 * escolhido o tipo, qual lugar.
 */
export function EscolhaDoLugar({
  geoserver,
  catalogo,
  dimensao,
  chave,
  nomes,
  lugar,
  ranking,
  onEstadoChange,
}: {
  geoserver: GeoServerApi;
  catalogo: Catalogo;
  dimensao: string | undefined;
  chave: string | undefined;
  nomes: NomeDimensao | undefined;
  /** O nome do lugar escolhido. */
  lugar: string;
  /** Os lugares da dimensão, com a área de cada um. */
  ranking: readonly ValorRanking[];
  onEstadoChange: (alteracao: AlteracaoPainel) => void;
}) {
  // As bacias juntas, do maior nível ao menor, para o nível ficar claro; os outros lugares, na
  // ordem do catálogo.
  const outrosLugares = catalogo.dimensoes.filter((d) => !CODIGOS_DE_BACIA.has(d.dimensao));
  const bacias = NIVEIS_DE_BACIA.flatMap(
    (n) => catalogo.dimensoes.find((d) => d.dimensao === n.dimensao) ?? [],
  );
  return (
    <div className="grid gap-2">
      <label className="text-[13px] font-medium" htmlFor="tipo-lugar">
        Mostrar dados de
      </label>
      <NativeSelect
        className="h-9 text-sm"
        id="tipo-lugar"
        onChange={(evento) =>
          onEstadoChange({
            dimensao: evento.target.value === "" ? undefined : evento.target.value,
            chave: undefined,
          })
        }
        value={dimensao ?? ""}
      >
        <option value="">o Brasil inteiro</option>
        {outrosLugares.map((d) => (
          <OpcaoDeLugar dimensao={d} key={d.dimensao} />
        ))}
        {bacias.length === 0 ? null : (
          <optgroup label="Bacias hidrográficas, do maior nível ao menor">
            {bacias.map((d) => (
              <OpcaoDeLugar dimensao={d} key={d.dimensao} />
            ))}
          </optgroup>
        )}
      </NativeSelect>
      {dimensao === undefined || nomes === undefined ? null : (
        <>
          <label className="text-[13px] font-medium" htmlFor="valor-dimensao">
            Qual {nomes.singular}?
          </label>
          <EscolhaValor
            chave={chave}
            dimensao={dimensao}
            geoserver={geoserver}
            nomes={nomes}
            onEscolher={(valor) => onEstadoChange({ chave: valor })}
            opcoes={ranking}
            rotulo={chave === undefined ? undefined : lugar}
          />
          {dimensao === "bacia" ? (
            <p className="text-[13px] text-muted-foreground">{NOTA_DO_NOME_DA_BACIA}</p>
          ) : null}
        </>
      )}
    </div>
  );
}

/** Um tipo de lugar em "Mostrar dados de", com o artigo: "uma bacia hidrográfica". */
function OpcaoDeLugar({ dimensao }: { dimensao: Catalogo["dimensoes"][number] }) {
  const nome = nomeDimensao(dimensao.dimensao, dimensao.titulo);
  return (
    <option value={dimensao.dimensao}>
      {nome.artigo} {nome.singular}
    </option>
  );
}
