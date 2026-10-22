import { SECOES, type SecaoDados } from "../utils/secoes";
import { ICONES } from "./icones";

/** Dentro de uma parte, as três no topo, a atual marcada, para passar de uma à outra. */
export function IndiceDasSecoes({
  secao,
  onEscolher,
}: {
  secao: SecaoDados;
  onEscolher: (secao: SecaoDados) => void;
}) {
  return (
    <nav aria-label="Partes do acesso aos dados">
      <ul className="flex flex-wrap gap-2">
        {SECOES.map((item) => {
          const Icone = ICONES[item.id];
          return (
            <li key={item.id}>
              <button
                aria-current={secao === item.id ? "true" : undefined}
                className="flex items-center gap-2 rounded-full border bg-card px-3.5 py-1.5 text-[15px] font-medium transition-colors hover:border-primary aria-[current=true]:border-primary aria-[current=true]:bg-accent aria-[current=true]:text-accent-foreground"
                onClick={() => onEscolher(item.id)}
                type="button"
              >
                <Icone aria-hidden className="size-4 shrink-0" />
                {item.rotulo}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
