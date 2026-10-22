import { formatarHectaresResumido, formatarParticipacao } from "@/shared/utils/formatos";

import { COR_UNICA } from "./cores";
import { dica, emBlocos } from "./dica";
import { GRADE, LINHA, NOME, TRILHO, VALOR } from "./grade";
import type { ItemBarra } from "./tipos";

/**
 * Barras horizontais de magnitude. `total` dá a participação de cada barra; sem ele (temas
 * que se sobrepõem), só a área. Com `onSelecionar`, cada linha é um botão.
 */
export function BarrasHorizontais({
  itens,
  total,
  onSelecionar,
}: {
  itens: readonly ItemBarra[];
  total?: number | undefined;
  onSelecionar?: ((chave: string) => void) | undefined;
}) {
  const maximo = Math.max(...itens.map((i) => i.valor), 0);
  return (
    <div className={`${GRADE} gap-y-3`}>
      {emBlocos(itens).map((bloco, indice) => (
        <div className="col-span-full grid grid-cols-subgrid gap-y-3" key={bloco.grupo ?? indice}>
          {bloco.grupo === undefined ? null : (
            <p
              className={`col-span-full text-sm font-semibold text-muted-foreground ${indice > 0 ? "mt-4" : ""}`}
            >
              {bloco.grupo}
            </p>
          )}
          <ul className="col-span-full grid grid-cols-subgrid gap-y-3">
            {bloco.itens.map((item) => {
              const largura = maximo > 0 ? (item.valor / maximo) * 100 : 0;
              const participacao =
                total !== undefined && total > 0 ? item.valor / total : undefined;
              const conteudo = (
                <>
                  <span className={NOME}>{item.rotulo}</span>
                  <span className={VALOR}>
                    {formatarHectaresResumido(item.valor)}
                    {participacao === undefined ? null : (
                      <span className="text-muted-foreground">
                        {" "}
                        · {formatarParticipacao(participacao)}
                      </span>
                    )}
                  </span>
                  <span aria-hidden className={TRILHO}>
                    <span
                      className="block h-full rounded-r-[4px]"
                      style={{
                        width: item.valor > 0 ? `max(${largura}%, 2px)` : 0,
                        backgroundColor: item.cor ?? COR_UNICA,
                      }}
                    />
                  </span>
                </>
              );
              const texto = dica(item.rotulo, item.valor, total, item.detalhe);
              return (
                <li className="col-span-full grid grid-cols-subgrid" key={item.chave}>
                  {onSelecionar === undefined ? (
                    <div className={LINHA} title={texto}>
                      {conteudo}
                    </div>
                  ) : (
                    <button
                      className={`${LINHA} -mx-2 rounded-md px-2 py-1.5 text-left hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring`}
                      onClick={() => onSelecionar(item.chave)}
                      title={texto}
                      type="button"
                    >
                      {conteudo}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}
