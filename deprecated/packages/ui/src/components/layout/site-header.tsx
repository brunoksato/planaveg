import { Menu, X } from "lucide-react";
import { useState, type ReactNode } from "react";

import { cn } from "../../lib/utils";
import { Button } from "../ui/button";

/**
 * Cabeçalho do portal numa faixa de 3.5rem: marca, navegação inline e ações. Em telas estreitas a
 * navegação vai para um menu recolhível abaixo da faixa. Abaixo de `xl`, onde a marca não tem
 * lugar para ele, o subtítulo vai numa linha embaixo da faixa (numa linha só de `lg` em diante).
 * A altura do cabeçalho inteiro é exposta em `--header-h` para os espaços de trabalho
 * calcularem a área restante: quem passa o subtítulo a aumenta abaixo de `xl` (`styles.css`).
 */
export function SiteHeader({
  brand,
  subtitle,
  nav,
  actions,
  className,
  pathname,
}: {
  brand: ReactNode;
  /** Abaixo de `xl`, numa linha embaixo da faixa. */
  subtitle?: ReactNode;
  nav?: ReactNode;
  actions?: ReactNode;
  className?: string;
  /** Caminho atual: fecha o menu móvel ao navegar. */
  pathname?: string;
}) {
  // O menu guarda o caminho em que abriu: ao navegar, o caminho muda e ele fecha sozinho. Sem
  // `pathname`, fica aberto até o botão fechar.
  const [abertoEm, setAbertoEm] = useState<string | null>(null);
  const aberto = abertoEm !== null && (pathname === undefined || abertoEm === pathname);
  return (
    <header className={cn("relative z-40 bg-header text-header-foreground", className)}>
      <div className="flex h-14 items-stretch gap-2 px-3 sm:px-4 lg:px-5">
        <div className="flex min-w-0 items-center gap-3 pr-3">{brand}</div>
        {nav !== undefined ? (
          <div className="hidden min-w-0 flex-1 items-stretch md:flex">{nav}</div>
        ) : (
          <div className="flex-1" />
        )}
        <div className="ml-auto flex items-center gap-2 text-sm">
          {actions}
          {nav !== undefined ? (
            <Button
              aria-controls="menu-portal"
              aria-expanded={aberto}
              aria-label={aberto ? "Fechar menu" : "Abrir menu"}
              className="text-header-foreground hover:bg-white/10 hover:text-header-foreground md:hidden"
              onClick={() => setAbertoEm(aberto ? null : (pathname ?? ""))}
              size="icon"
              type="button"
              variant="ghost"
            >
              {aberto ? <X /> : <Menu />}
            </Button>
          ) : null}
        </div>
      </div>
      {subtitle === undefined ? null : (
        <p className="border-t border-white/10 px-3 py-1 text-xs text-header-muted sm:px-4 lg:h-7 lg:truncate lg:px-5 lg:py-0 lg:leading-7 xl:hidden">
          {subtitle}
        </p>
      )}
      {nav !== undefined && aberto ? (
        <div
          className="absolute inset-x-0 top-full border-t border-white/10 bg-header shadow-md md:hidden"
          id="menu-portal"
        >
          <div className="flex flex-col px-2 py-2 [&_.topnav-link]:h-11 [&_.topnav-link]:rounded-md [&_.topnav-link]:border-b-0 [&_.topnav-link]:px-3 [&_.topnav-link[aria-current=page]]:bg-white/10 [&_nav]:flex [&_nav]:flex-col [&_nav]:items-stretch [&_nav]:gap-0.5">
            {nav}
          </div>
        </div>
      ) : null}
    </header>
  );
}
