import { MENOS_DE } from "@/shared/utils/formatos";

/**
 * O número grande e a unidade menor ao lado, sem quebrar a linha do número. O "menos de" de uma
 * lasca ("menos de 0,1 ha", de `formatarHectaresResumido`) ou de uma fração pequena ("menos de
 * 0,1%", de `formatarParticipacao`) vai pequeno, como a unidade, e o grande continua o número.
 */
export function Numero({
  valor,
  grande = false,
  destaque = false,
}: {
  valor: string;
  grande?: boolean;
  destaque?: boolean;
}) {
  const menos = valor.startsWith(MENOS_DE);
  const [numero = valor, ...resto] = (menos ? valor.slice(MENOS_DE.length) : valor).split(" ");
  const unidade = resto.join(" ");
  return (
    <p className="mt-1 flex flex-wrap items-baseline gap-x-1.5">
      {menos ? (
        <>
          <span className="text-sm font-medium text-muted-foreground">{MENOS_DE.trim()}</span>{" "}
        </>
      ) : null}
      <span
        className={`font-semibold tracking-tight whitespace-nowrap tabular-nums ${grande ? "text-4xl" : "text-2xl"} ${destaque ? "text-primary" : ""}`}
      >
        {numero}
      </span>{" "}
      {unidade === "" ? null : (
        <span className="text-sm font-medium text-muted-foreground">{unidade}</span>
      )}
    </p>
  );
}
