/**
 * Escolha de uma opção entre poucas, lado a lado (nível das bacias, fundo do mapa): botões com
 * estado pressionado explícito dentro de um grupo com nome, acessível por teclado. Clicar na
 * opção já marcada não muda nada, e `onChange` só vem quando a escolha muda.
 */
export function Segmentado<T extends string | number>({
  legenda,
  opcoes,
  valor,
  onChange,
  compacto = false,
}: {
  /** Nome do grupo, escrito acima das opções. */
  legenda: string;
  opcoes: ReadonlyArray<{ valor: T; rotulo: string }>;
  valor: T;
  onChange: (valor: T) => void;
  /** Menor, para caber num cartão do painel. */
  compacto?: boolean;
}) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-medium">{legenda}</legend>
      <div className="inline-flex flex-wrap gap-1 rounded-lg bg-muted p-1">
        {opcoes.map((opcao) => (
          <button
            aria-pressed={opcao.valor === valor}
            className={`rounded-md font-medium text-muted-foreground transition-colors hover:text-foreground aria-pressed:bg-card aria-pressed:text-primary aria-pressed:shadow-sm ${compacto ? "min-w-14 px-2.5 py-1 text-sm" : "min-w-16 px-3 py-1.5 text-[15px]"}`}
            key={opcao.valor}
            onClick={() => {
              if (opcao.valor !== valor) onChange(opcao.valor);
            }}
            type="button"
          >
            {opcao.rotulo}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
