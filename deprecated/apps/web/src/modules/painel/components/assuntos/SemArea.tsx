/** No lugar do gráfico, quando não há área a mostrar (no lugar ou com os filtros). */
export function SemArea({ texto }: { texto?: string }) {
  return (
    <p className="rounded-xl bg-muted px-5 py-4 text-[15px] text-muted-foreground">
      {texto ?? "Sem área contabilizada."}
    </p>
  );
}
