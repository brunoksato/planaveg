import { useState } from "react";

import {
  formatarHectaresResumido,
  formatarParte,
  formatarParticipacao,
  hectaresPorExtenso,
} from "@/shared/utils/formatos";
import { somar } from "@/shared/utils/numeros";

import { corDoTextoSobre } from "./cores";
import { dica } from "./dica";
import type { Fatia } from "./tipos";

const RAIO = 80;
const ESPESSURA = 36;
const CIRCUNFERENCIA = 2 * Math.PI * RAIO;
/** Espaço entre fatias, em unidades do desenho (200 × 200): cerca de 2 px na tela. */
const FOLGA = 1.6;
/** Fatias menores que isso não levam o percentual escrito em cima. */
const FATIA_COM_ROTULO = 0.04;

/**
 * Rosca para as partes de um todo (poucas categorias que somam o total). O percentual vai
 * escrito na fatia e na legenda, para a categoria não depender só da cor; passar o mouse numa
 * fatia destaca a fatia e o item da legenda e mostra a área dela no centro. Com `soPercentual`,
 * a legenda traz só o percentual de cada parte, em destaque, e a área fica na dica.
 */
export function Rosca({
  fatias,
  rotuloTotal,
  soPercentual = false,
}: {
  fatias: readonly Fatia[];
  rotuloTotal: string;
  soPercentual?: boolean;
}) {
  const [ativa, setAtiva] = useState<string | undefined>();
  const total = somar(fatias);
  // Onde cada fatia começa na volta: a soma das que vêm antes dela.
  const inicios: number[] = [];
  let acumulado = 0;
  for (const fatia of fatias) {
    inicios.push(acumulado);
    acumulado += fatia.valor;
  }
  const destaque = fatias.find((fatia) => fatia.chave === ativa);
  const centro = hectaresPorExtenso(destaque?.valor ?? total);
  return (
    // Na largura `@xl`, a coluna da rosca tem a largura do desenho (`auto`): uma medida só, a do
    // `size-60`, e o espaço até a legenda é o `gap-x-10` inteiro.
    <div className="grid items-center gap-x-10 gap-y-6 @xl:grid-cols-[auto_minmax(0,1fr)]">
      <div className="relative mx-auto size-60">
        <svg aria-hidden className="size-full" viewBox="0 0 200 200">
          <g transform="rotate(-90 100 100)">
            {fatias.map((fatia, indice) => {
              if (fatia.valor <= 0 || total <= 0) return null;
              const comprimento = (fatia.valor / total) * CIRCUNFERENCIA;
              return (
                <circle
                  cx="100"
                  cy="100"
                  fill="none"
                  key={fatia.chave}
                  onMouseEnter={() => setAtiva(fatia.chave)}
                  onMouseLeave={() => setAtiva(undefined)}
                  opacity={ativa === undefined || ativa === fatia.chave ? 1 : 0.3}
                  r={RAIO}
                  stroke={fatia.cor}
                  strokeDasharray={`${Math.max(comprimento - FOLGA, 0.6)} ${CIRCUNFERENCIA}`}
                  strokeDashoffset={-((inicios[indice] ?? 0) / total) * CIRCUNFERENCIA}
                  strokeWidth={ESPESSURA}
                >
                  <title>{dica(fatia.rotulo, fatia.valor, total, fatia.detalhe)}</title>
                </circle>
              );
            })}
          </g>
          {fatias.map((fatia, indice) => {
            const fracao = total > 0 ? fatia.valor / total : 0;
            if (fracao < FATIA_COM_ROTULO) return null;
            // Meio da fatia, a partir do topo, no sentido horário.
            const angulo = (((inicios[indice] ?? 0) / total + fracao / 2) * 2 - 0.5) * Math.PI;
            return (
              <text
                className="pointer-events-none text-[11px] font-semibold tabular-nums"
                dominantBaseline="central"
                fill={corDoTextoSobre(fatia.cor)}
                key={fatia.chave}
                opacity={ativa === undefined || ativa === fatia.chave ? 1 : 0.4}
                textAnchor="middle"
                x={100 + RAIO * Math.cos(angulo)}
                y={100 + RAIO * Math.sin(angulo)}
              >
                {formatarParticipacao(fracao)}
              </text>
            );
          })}
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-12 text-center">
          <span className="text-3xl leading-none font-semibold tracking-tight tabular-nums">
            {centro.numero}
          </span>
          <span className="mt-1 text-sm leading-tight text-muted-foreground">{centro.unidade}</span>
          <span className="mt-1 line-clamp-2 text-xs leading-tight font-medium">
            {destaque?.rotulo ?? rotuloTotal}
          </span>
        </div>
      </div>
      <ul className="space-y-5">
        {fatias.map((fatia) => (
          <li
            className="flex gap-3 transition-opacity"
            key={fatia.chave}
            style={{ opacity: ativa === undefined || ativa === fatia.chave ? 1 : 0.5 }}
          >
            <span
              aria-hidden
              className={`size-4 shrink-0 rounded-[4px] ${soPercentual ? "mt-2" : "mt-1"}`}
              style={{ backgroundColor: fatia.cor }}
            />
            {soPercentual ? (
              // O percentual é o número da parte: grande, antes do nome, numa coluna só.
              <span
                className="w-20 shrink-0 text-3xl leading-none font-semibold tracking-tight whitespace-nowrap tabular-nums"
                title={dica(fatia.rotulo, fatia.valor, total, fatia.detalhe)}
              >
                {formatarParte(fatia.valor, total)}
              </span>
            ) : null}
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5">
                <span className="text-[15px] font-semibold">{fatia.rotulo}</span>
                {soPercentual ? null : (
                  <span className="text-[15px] whitespace-nowrap tabular-nums">
                    {formatarHectaresResumido(fatia.valor)}
                    <span className="text-muted-foreground">
                      {" "}
                      · {formatarParte(fatia.valor, total)}
                    </span>
                  </span>
                )}
              </p>
              {fatia.descricao === undefined ? null : (
                <p className="mt-1 text-sm text-muted-foreground">{fatia.descricao}</p>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
