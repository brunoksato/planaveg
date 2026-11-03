import type { ReactNode } from "react";

/** Um bloco de conteúdo: título, frase de abertura e o resto. */
export function Bloco({
  id,
  titulo,
  descricao,
  children,
}: {
  id: string;
  titulo: string;
  descricao?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <section
      aria-labelledby={id}
      className="rounded-2xl border bg-card px-5 py-6 shadow-xs sm:px-8 sm:py-7"
    >
      <h3 className="text-lg font-semibold" id={id}>
        {titulo}
      </h3>
      {descricao === undefined ? null : (
        <p className="mt-2 max-w-3xl text-[15px] leading-relaxed text-muted-foreground">
          {descricao}
        </p>
      )}
      {children === undefined ? null : <div className="mt-5">{children}</div>}
    </section>
  );
}
