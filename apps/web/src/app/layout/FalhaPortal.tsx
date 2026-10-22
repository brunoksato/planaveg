import type { ErrorComponentProps } from "@tanstack/react-router";

/** A tela de erro do portal, no lugar da página que falhou. */
export function FalhaPortal({ reset }: ErrorComponentProps) {
  return (
    <main className="mx-auto grid min-h-dvh max-w-3xl place-content-center gap-4 px-6 text-center">
      <p className="text-sm font-semibold uppercase tracking-wide text-primary">
        SINAVEG · Planaveg
      </p>
      <h1 className="text-3xl font-semibold">Não foi possível mostrar esta página</h1>
      <p className="text-muted-foreground">
        Os dados não foram alterados. Tente carregar a página novamente ou volte à visão geral.
      </p>
      <div className="flex justify-center gap-3">
        <button
          className="rounded-md bg-primary px-4 py-2 text-primary-foreground"
          onClick={reset}
          type="button"
        >
          Tentar novamente
        </button>
        <a className="rounded-md border px-4 py-2" href="/">
          Voltar à visão geral
        </a>
      </div>
    </main>
  );
}
