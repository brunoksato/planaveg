import { mesmoNome } from "@/shared/utils/glossario";

/** "Nome no relatório: …", sob o nome simples, quando ele é outro (a sigla não conta). */
export function NomeOficial({ nome, oficial }: { nome: string; oficial: string }) {
  if (mesmoNome(nome, oficial)) return null;
  return (
    <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
      Nome no relatório: {oficial}
    </span>
  );
}
