import { SECOES, type SecaoDados } from "../utils/secoes";
import { ICONES } from "./icones";

/**
 * A entrada de Acesso aos dados, como no TerraBrasilis: um cartão por parte (downloads,
 * metadados e serviços web), com o ícone, o nome e o que se encontra nela.
 */
export function PartesDoAcesso({ onEscolher }: { onEscolher: (secao: SecaoDados) => void }) {
  return (
    <ul className="grid gap-4 md:grid-cols-3">
      {SECOES.map((item) => {
        const Icone = ICONES[item.id];
        return (
          <li key={item.id}>
            <button
              className="flex h-full w-full flex-col items-center rounded-2xl border bg-card px-6 py-8 text-center shadow-xs transition-colors hover:border-primary"
              onClick={() => onEscolher(item.id)}
              type="button"
            >
              <span
                aria-hidden
                className="grid size-20 place-content-center rounded-full bg-accent text-primary"
              >
                <Icone className="size-9" />
              </span>
              <span className="mt-5 text-xl font-semibold">{item.rotulo}</span>
              <span className="mt-2 text-[15px] text-muted-foreground">{item.resumo}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
