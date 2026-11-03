import { Link } from "@tanstack/react-router";
import { ArrowRight, type LucideIcon } from "lucide-react";

/** Um cartão de caminho: o ícone e o nome da página, o mesmo do topo. */
export function Caminho({
  to,
  titulo,
  icone: Icone,
}: {
  to: "/mapa" | "/painel" | "/dados";
  titulo: string;
  icone: LucideIcon;
}) {
  return (
    <li>
      <Link
        className="group flex h-full flex-col rounded-2xl border bg-card p-6 shadow-xs transition-colors hover:border-primary"
        to={to}
      >
        <span
          aria-hidden
          className="grid size-11 place-content-center rounded-full bg-accent text-primary"
        >
          <Icone className="size-5" />
        </span>
        <span className="mt-4 inline-flex items-center gap-2 text-xl font-semibold group-hover:text-primary">
          {titulo}
          <ArrowRight aria-hidden className="size-5 text-primary" />
        </span>
      </Link>
    </li>
  );
}
