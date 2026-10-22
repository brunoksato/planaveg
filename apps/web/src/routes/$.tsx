import { createFileRoute, redirect } from "@tanstack/react-router";

/** Qualquer caminho desconhecido volta à página inicial. */
export const Route = createFileRoute("/$")({
  beforeLoad: () => {
    throw redirect({ to: "/", replace: true });
  },
});
