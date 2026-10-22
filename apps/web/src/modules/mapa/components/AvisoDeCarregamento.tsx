import { LoaderCircle, TriangleAlert } from "lucide-react";

/**
 * No alto do mapa: "Carregando o mapa…" enquanto algum tile chega ou, quando algum não veio (o
 * GeoServer fora do ar, um erro no desenho), o aviso de que parte do mapa falta.
 */
export function AvisoDeCarregamento({
  filtrado,
  falhou,
}: {
  /** O mapa tem filtro: o servidor desenha um filtro novo na primeira vez. */
  filtrado: boolean;
  /** Algum tile não veio, e nada está carregando agora. */
  falhou: boolean;
}) {
  if (falhou) {
    return (
      <p
        className="absolute top-3 left-1/2 z-[1000] flex w-max max-w-[calc(100%-7rem)] -translate-x-1/2 items-center gap-2 rounded-2xl border border-danger/30 bg-danger-soft px-3.5 py-1.5 text-sm text-danger shadow"
        role="alert"
      >
        <TriangleAlert aria-hidden className="size-4 shrink-0" />
        Parte do mapa não carregou. Recarregue a página para tentar de novo.
      </p>
    );
  }
  return (
    <output className="absolute top-3 left-1/2 z-[1000] flex -translate-x-1/2 items-center gap-2 rounded-full bg-card/95 px-3.5 py-1.5 text-sm whitespace-nowrap shadow">
      <LoaderCircle aria-hidden className="size-4 animate-spin" />
      {/* Um filtro novo é desenhado pelo servidor na primeira vez; depois sai do cache. */}
      {filtrado ? "Desenhando as áreas filtradas…" : "Carregando o mapa…"}
    </output>
  );
}
