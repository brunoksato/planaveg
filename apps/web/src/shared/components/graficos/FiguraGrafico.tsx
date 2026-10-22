import type { ReactNode } from "react";

/** A moldura de um gráfico: o título (acessível sempre), a descrição e o gráfico. */
export function FiguraGrafico({
  titulo,
  mostrarTitulo = true,
  descricao,
  children,
}: {
  /** Nome do gráfico (acessível sempre; visível se `mostrarTitulo`). */
  titulo: string;
  mostrarTitulo?: boolean;
  descricao?: ReactNode;
  children: ReactNode;
}) {
  return (
    // `@container`: o gráfico se arranja pela largura que tem (um cartão do painel, metade da
    // página), não pela da janela.
    <figure aria-label={titulo} className="@container min-w-0">
      {mostrarTitulo || descricao !== undefined ? (
        <figcaption className="mb-4">
          {mostrarTitulo ? <span className="block text-base font-semibold">{titulo}</span> : null}
          {descricao === undefined ? null : (
            <span className="mt-0.5 block text-sm text-muted-foreground">{descricao}</span>
          )}
        </figcaption>
      ) : null}
      {children}
    </figure>
  );
}
