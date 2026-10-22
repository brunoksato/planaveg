import { ListFilter } from "lucide-react";

/**
 * No alto do mapa, à esquerda: o aviso de que um filtro das listas (estado, tema…) esconde parte
 * das áreas dos tipos marcados.
 */
export function AvisosDoTopo({ filtrado, onLimpar }: { filtrado: boolean; onLimpar: () => void }) {
  return (
    <div className="absolute top-3 left-3 z-[1000] flex max-w-[calc(100%-5rem)] flex-col items-start gap-2">
      {filtrado ? (
        <p className="flex max-w-full items-center gap-2 rounded-full bg-card/95 py-1.5 pr-1.5 pl-3.5 text-sm shadow">
          <ListFilter aria-hidden className="size-4 shrink-0 text-primary" />
          <span className="truncate">Só as áreas filtradas</span>
          <button
            className="shrink-0 rounded-full px-2 py-0.5 font-medium text-primary hover:bg-muted"
            onClick={onLimpar}
            type="button"
          >
            Limpar
          </button>
        </p>
      ) : null}
    </div>
  );
}
