/* oxlint-disable jsx-a11y/prefer-tag-over-role -- O padrão WAI-ARIA combobox exige popup listbox; select/datalist não expõem loading nem contagens remotas. */
import { LoaderCircle, Search, X } from "lucide-react";
import { type KeyboardEvent, useId, useState } from "react";

type OpcaoAutocompleteDominio = {
  valor: string;
  /** Texto mostrado; sem ele, o próprio valor. */
  rotulo?: string | undefined;
  /** Informação à direita da opção (contagem, UF, hectares). */
  detalhe?: string | undefined;
};

/**
 * Um campo de busca com sugestões, no padrão combobox do WAI-ARIA: a lista abre ao digitar, as
 * setas andam por ela e Enter escolhe. O valor escolhido fica acima do campo, num botão que o
 * tira. Quem usa o campo faz a busca e passa as `opcoes`.
 */
export function AutocompleteDominio({
  consulta,
  id,
  carregando,
  maisResultados,
  onChange,
  onConsultaChange,
  opcoes,
  placeholder,
  valor,
  valorRotulo,
  nomeDoRemover,
}: {
  consulta: string;
  id: string;
  carregando: boolean;
  maisResultados: boolean;
  onChange: (valor: string | undefined) => void;
  onConsultaChange: (consulta: string) => void;
  opcoes: OpcaoAutocompleteDominio[];
  placeholder: string;
  valor: string | undefined;
  /** Texto do valor escolhido, quando o valor é um código. */
  valorRotulo?: string | undefined;
  /**
   * O nome do botão que tira o valor escolhido, com o texto dele: diz o que tirar faz em cada
   * tela ("Tirar Bonito (MS) do mapa", "Tirar Mato Grosso e escolher outro estado").
   */
  nomeDoRemover: (escolhido: string) => string;
}) {
  const [aberto, setAberto] = useState(false);
  const [indiceAtivo, setIndiceAtivo] = useState(0);
  const sufixo = useId().replaceAll(":", "");
  const listaId = `${id}-opcoes-${sufixo}`;
  const consultaCurta = consulta.trim().length === 1;
  const exibirLista = aberto && !consultaCurta;
  // A opção que as setas apontam, com a lista aberta.
  const ativa = exibirLista ? opcoes[indiceAtivo] : undefined;

  function selecionar(novoValor: string | undefined): void {
    onChange(novoValor);
    onConsultaChange("");
    setAberto(false);
    setIndiceAtivo(0);
  }

  /** As setas andam pela lista, Enter escolhe a opção apontada e Esc fecha a lista. */
  function teclar(evento: KeyboardEvent<HTMLInputElement>): void {
    if (evento.key === "Escape") {
      setAberto(false);
      return;
    }
    if (evento.key === "ArrowDown") {
      evento.preventDefault();
      setAberto(true);
      setIndiceAtivo((indice) => Math.min(indice + 1, Math.max(0, opcoes.length - 1)));
      return;
    }
    if (evento.key === "ArrowUp") {
      evento.preventDefault();
      setIndiceAtivo((indice) => Math.max(0, indice - 1));
      return;
    }
    if (evento.key === "Enter" && ativa !== undefined) {
      evento.preventDefault();
      selecionar(ativa.valor);
    }
  }

  return (
    <div
      className="relative"
      onBlur={(evento) => {
        if (!evento.currentTarget.contains(evento.relatedTarget)) setAberto(false);
      }}
    >
      {valor === undefined ? null : (
        <ValorEscolhido
          nome={nomeDoRemover(valorRotulo ?? valor)}
          onRemover={() => selecionar(undefined)}
          texto={valorRotulo ?? valor}
        />
      )}
      <div className="relative">
        <Search
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <input
          aria-activedescendant={
            ativa === undefined ? undefined : `${listaId}-opcao-${indiceAtivo}`
          }
          aria-autocomplete="list"
          aria-busy={carregando}
          aria-controls={listaId}
          aria-expanded={exibirLista}
          className="h-10 w-full rounded-md border border-input bg-background pr-9 pl-9 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 focus-visible:outline-none"
          id={id}
          maxLength={100}
          onChange={(evento) => {
            onConsultaChange(evento.target.value);
            setAberto(true);
            setIndiceAtivo(0);
          }}
          onFocus={() => setAberto(true)}
          onKeyDown={teclar}
          placeholder={valor === undefined ? placeholder : "Buscar outro valor…"}
          role="combobox"
          type="search"
          value={consulta}
        />
        {carregando ? (
          <output
            aria-live="polite"
            className="absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin text-muted-foreground"
          >
            <LoaderCircle aria-hidden className="size-4" />
            <span className="sr-only">Carregando opções</span>
          </output>
        ) : null}
      </div>
      {aberto && consultaCurta ? (
        <p className="mt-1 text-xs text-muted-foreground">Digite mais um caractere para buscar.</p>
      ) : null}
      {exibirLista ? (
        <ListaDeOpcoes
          carregando={carregando}
          id={listaId}
          indiceAtivo={indiceAtivo}
          maisResultados={maisResultados}
          onApontar={setIndiceAtivo}
          onEscolher={selecionar}
          opcoes={opcoes}
          valor={valor}
        />
      ) : null}
    </div>
  );
}

/** O valor escolhido, num botão que o tira. */
function ValorEscolhido({
  texto,
  nome,
  onRemover,
}: {
  texto: string;
  /** O nome do botão, que diz o que tirar faz. */
  nome: string;
  onRemover: () => void;
}) {
  return (
    <button
      aria-label={nome}
      className="mb-1.5 inline-flex max-w-full items-center gap-1 rounded-full border border-primary/30 bg-accent px-2.5 py-0.5 text-xs font-medium text-accent-foreground hover:bg-accent/70"
      onClick={onRemover}
      type="button"
    >
      <span className="truncate">{texto}</span>
      <X aria-hidden className="size-3" />
    </button>
  );
}

/** A lista de sugestões (`listbox`), com a opção apontada pelas setas em destaque. */
function ListaDeOpcoes({
  id,
  opcoes,
  valor,
  indiceAtivo,
  carregando,
  maisResultados,
  onEscolher,
  onApontar,
}: {
  id: string;
  opcoes: OpcaoAutocompleteDominio[];
  valor: string | undefined;
  indiceAtivo: number;
  carregando: boolean;
  maisResultados: boolean;
  onEscolher: (valor: string) => void;
  onApontar: (indice: number) => void;
}) {
  return (
    <div
      className="absolute z-[1001] mt-1 max-h-64 w-full overflow-y-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
      id={id}
      role="listbox"
    >
      {!carregando && opcoes.length === 0 ? (
        <p className="px-2 py-2 text-xs text-muted-foreground">Nenhum valor encontrado.</p>
      ) : null}
      {opcoes.map((opcao, indice) => (
        <button
          aria-selected={valor === opcao.valor}
          className={`flex w-full items-center justify-between gap-3 rounded-sm px-2 py-2 text-left text-sm hover:bg-accent focus:bg-accent focus:outline-none ${indice === indiceAtivo ? "bg-accent" : ""}`}
          id={`${id}-opcao-${indice}`}
          key={opcao.valor}
          onClick={() => onEscolher(opcao.valor)}
          onMouseEnter={() => onApontar(indice)}
          role="option"
          type="button"
        >
          <span className="truncate">{opcao.rotulo ?? opcao.valor}</span>
          {opcao.detalhe === undefined ? null : (
            <span className="shrink-0 text-xs text-muted-foreground">{opcao.detalhe}</span>
          )}
        </button>
      ))}
      {maisResultados ? (
        <p className="border-t px-2 py-2 text-xs text-muted-foreground">
          Continue digitando para refinar os resultados.
        </p>
      ) : null}
    </div>
  );
}
