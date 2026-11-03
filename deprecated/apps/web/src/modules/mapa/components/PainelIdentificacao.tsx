import { Info, X } from "lucide-react";

import type { CatalogoArranjo, CatalogoNivel } from "@sinaveg/web-contracts";

import { ErroCarregamento } from "@/shared/components/ErroCarregamento";
import type { Catalogo } from "@/shared/services/catalogo.service";
import { formatarAreaMapeada } from "@/shared/utils/formatos";
import { nomeCondicaoCar, termoArranjo, termoNivel } from "@/shared/utils/glossario";

import type { Identificacao } from "../types";
import {
  descreverConjunto,
  descreverProjetos,
  descreverUc,
  siglasSobreposicao,
} from "../utils/peca";

/**
 * As áreas sob o clique, nas áreas de um ano: o tipo, a situação, o arranjo, a área do polígono
 * clicado (e a da peça inteira de que ele faz parte), o lugar, os projetos e a UC.
 */
export function PainelIdentificacao({
  catalogo,
  identificacao,
  onFechar,
}: {
  catalogo: Catalogo;
  identificacao: Identificacao;
  onFechar: () => void;
}) {
  const nivel = new Map(catalogo.niveis.map((n) => [n.nivel, n]));
  const arranjo = new Map(catalogo.arranjos.map((a) => [a.arranjo, a]));
  return (
    <section
      aria-label="Áreas neste ponto"
      className="absolute right-3 bottom-8 z-[1000] max-h-[60%] w-[min(24rem,calc(100%-1.5rem))] overflow-y-auto rounded-xl border bg-card p-4 shadow-lg"
    >
      <header className="mb-2 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-1.5 text-[15px] font-semibold">
          <Info aria-hidden className="size-4 text-primary" />
          Áreas neste ponto
        </h2>
        <button
          aria-label="Fechar"
          className="rounded p-1 text-muted-foreground hover:bg-muted"
          onClick={onFechar}
          type="button"
        >
          <X aria-hidden className="size-4" />
        </button>
      </header>
      {identificacao.erro === undefined ? null : (
        <ErroCarregamento>
          Não foi possível consultar as áreas deste ponto: {identificacao.erro}
        </ErroCarregamento>
      )}
      {identificacao.erro === undefined && identificacao.pecas.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {identificacao.consultando ? "Consultando…" : "Nenhuma área contabilizada neste ponto."}
        </p>
      ) : null}
      {identificacao.pecas.length === 0 ? null : (
        <ul className="space-y-3">
          {identificacao.pecas.map((peca) => (
            <PecaIdentificada
              arranjo={peca.arranjo === null ? undefined : arranjo.get(peca.arranjo)}
              key={peca.fid}
              nivel={peca.nivel === null ? undefined : nivel.get(peca.nivel)}
              peca={peca}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

/** Uma área sob o clique: o tipo, na cor do mapa, e o que se sabe dela. */
function PecaIdentificada({
  peca,
  nivel,
  arranjo,
}: {
  peca: Identificacao["pecas"][number];
  /** O nível da peça no catálogo; sem ele, o rótulo que veio na peça. */
  nivel: CatalogoNivel | undefined;
  arranjo: CatalogoArranjo | undefined;
}) {
  const conjunto = descreverConjunto(peca);
  return (
    <li className="space-y-1 border-t pt-2 first:border-t-0 first:pt-0">
      <p className="flex items-start gap-2 text-[15px] font-semibold">
        <span
          aria-hidden
          className="mt-1 size-3.5 shrink-0 rounded-[4px]"
          style={{ backgroundColor: nivel?.cor ?? "#999999" }}
        />
        {nivel === undefined ? peca.hierarquia : termoNivel(nivel.nivel, nivel.titulo).nome}
      </p>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
        <Campo
          nome="Situação do cadastro"
          valor={peca.categoria === null ? undefined : nomeCondicaoCar(peca.categoria)}
        />
        <Campo
          nome="Arranjo"
          valor={
            arranjo === undefined
              ? (peca.arranjo ?? "—")
              : termoArranjo(arranjo.arranjo, arranjo.titulo).nome
          }
        />
        <Campo nome="Área" valor={formatarAreaMapeada(peca.poligono?.area_ha ?? peca.area_ha)} />
        <Campo
          nome="Município"
          valor={peca.municipio === null ? "—" : `${peca.municipio} (${peca.uf ?? "—"})`}
        />
        <Campo nome="Bioma · bacia" valor={`${peca.bioma ?? "—"} · ${peca.bacia ?? "—"}`} />
        <Campo nome="Projetos" valor={descreverProjetos(peca)} />
        <Campo
          nome="Sobreposta a"
          valor={peca.sobreposicao === null ? undefined : siglasSobreposicao(peca.sobreposicao)}
        />
        <Campo nome="Unidade de Conservação" valor={descreverUc(peca)} />
      </dl>
      {conjunto === undefined ? null : (
        <p className="text-[13px] leading-5 text-muted-foreground">{conjunto}</p>
      )}
    </li>
  );
}

/** Um dado da área, com o nome; sem valor, a linha não aparece. */
function Campo({ nome, valor }: { nome: string; valor: string | undefined }) {
  if (valor === undefined) return null;
  return (
    <>
      <dt className="text-muted-foreground">{nome}</dt>
      <dd>{valor}</dd>
    </>
  );
}
