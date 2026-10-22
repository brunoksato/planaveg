import { Outlet, useLocation } from "@tanstack/react-router";

import { CabecalhoDoPortal } from "./CabecalhoDoPortal";
import { RodapeDoPortal } from "./RodapeDoPortal";

/** Cabeçalho institucional, navegação por seções e rodapé do portal público. */
export function PortalShell() {
  // Só o caminho: mover o mapa muda a busca da URL, e o cabeçalho e o rodapé não precisam ser
  // refeitos a cada movimento.
  const pathname = useLocation({ select: (local) => local.pathname });
  // O mapa é um espaço de trabalho: ocupa a altura restante da janela, sem contêiner nem
  // rodapé, para o mapa ser a própria página. O painel tem a lateral do mapa encostada na borda
  // (sem contêiner), mas rola como página e tem rodapé. As outras telas são páginas lidas de
  // cima a baixo.
  const espacoDeTrabalho = pathname.startsWith("/mapa");
  const comLateral = pathname.startsWith("/painel");
  return (
    <div className="flex min-h-dvh flex-col">
      <a
        className="sr-only px-3 py-2 text-sm focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-card focus:shadow-md"
        href="#conteudo-principal"
      >
        Ir para o conteúdo
      </a>
      <CabecalhoDoPortal pathname={pathname} />
      <main
        className={
          espacoDeTrabalho
            ? "flex min-h-0 flex-1 flex-col"
            : comLateral
              ? "flex-1"
              : "sinaveg-container flex-1 py-8"
        }
        id="conteudo-principal"
      >
        <Outlet />
      </main>
      {espacoDeTrabalho ? null : <RodapeDoPortal />}
    </div>
  );
}
