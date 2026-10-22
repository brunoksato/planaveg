import { FileSpreadsheet } from "lucide-react";

/** Link de download; só com o formato na tela, o nome completo vai para leitores de tela. */
export function LinkArquivo({
  href,
  formato,
  nome,
  visivel = false,
}: {
  href: string;
  formato: string;
  nome: string;
  /** Mostra o nome também na tela ("Áreas de 2024 (CSV)"), não só o formato. */
  visivel?: boolean;
}) {
  return (
    <a
      // O nome começa pelo texto visível (WCAG 2.5.3): "CSV de Área por categoria".
      aria-label={visivel ? undefined : `${formato} de ${nome}`}
      className="inline-flex items-center gap-1.5 text-[15px] font-medium text-primary hover:underline"
      download
      href={href}
    >
      <FileSpreadsheet aria-hidden className="size-4" />
      {visivel ? `${nome} (${formato})` : formato}
    </a>
  );
}
