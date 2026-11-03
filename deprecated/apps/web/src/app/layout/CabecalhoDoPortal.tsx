import { Link } from "@tanstack/react-router";
import { Leaf } from "lucide-react";

import { BrandMark, SiteHeader } from "@sinaveg/ui";

import { NAVEGACAO_PORTAL } from "./nav-items";

const NOME_COMPLETO =
  "Sistema Nacional de Monitoramento Geoespacial e Reporte de Áreas em Processo de Recuperação da Vegetação Nativa";

/** O cabeçalho institucional: a marca, a navegação por seções, o selo e o link do MMA. */
export function CabecalhoDoPortal({ pathname }: { pathname: string }) {
  return (
    <SiteHeader
      actions={
        // O selo e o link vão onde cabem na faixa: com o menu recolhido (de `sm` a `md`) e com a
        // navegação inteira a partir de `lg`. Entre `md` e `lg`, a navegação ocupa a faixa.
        <>
          <span
            className="hidden rounded-full border border-white/15 px-2.5 py-0.5 text-xs font-medium whitespace-nowrap text-header-muted sm:inline md:hidden lg:inline"
            title="O resultado só se torna Resultado Oficial Planaveg após aprovação do Plenário da Conaveg e publicação pelo MMA."
          >
            Estimativa Técnica
          </span>
          <a
            className="hidden text-[0.8125rem] text-header-muted hover:text-header-foreground sm:inline md:hidden lg:inline"
            href="https://www.gov.br/mma"
            rel="noreferrer"
            target="_blank"
          >
            gov.br/mma
          </a>
        </>
      }
      brand={
        <Link
          className="flex min-w-0 items-center gap-3 xl:max-w-[29rem]"
          title={NOME_COMPLETO}
          to="/"
        >
          <BrandMark
            logo={<Leaf aria-hidden />}
            subtitle={NOME_COMPLETO}
            title="SINAVEG · Planaveg"
          />
        </Link>
      }
      nav={
        <nav
          aria-label="Seções do portal"
          className="flex items-stretch md:ml-2 md:border-l md:border-white/10 md:pl-2"
        >
          {NAVEGACAO_PORTAL.map((item) => {
            const ativo = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
            return (
              <Link
                aria-current={ativo ? "page" : undefined}
                className="topnav-link"
                key={item.to}
                to={item.to}
              >
                <item.icon aria-hidden className="size-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      }
      pathname={pathname}
      subtitle={NOME_COMPLETO}
    />
  );
}
