import type { SegmentoEmpilhado } from "./tipos";

/** A legenda de cores de um gráfico: um quadrado na cor e o nome de cada parte. */
export function LegendaDoGrafico({ itens }: { itens: readonly SegmentoEmpilhado[] }) {
  return (
    <ul aria-label="Legenda" className="flex flex-wrap gap-x-5 gap-y-2">
      {itens.map((item) => (
        <li className="flex items-center gap-2 text-sm" key={item.chave}>
          <span
            aria-hidden
            className="size-3.5 rounded-[4px]"
            style={{ backgroundColor: item.cor }}
          />
          {item.rotulo}
        </li>
      ))}
    </ul>
  );
}
