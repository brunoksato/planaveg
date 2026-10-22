"""`verify`: as dezesseis invariantes; sai com 1 se alguma reprovar sem ser aceita."""

from __future__ import annotations

import argparse
from dataclasses import dataclass

from planaveg_core import banco, etapas
from planaveg_core.cli.codigos import EXIT_OK, EXIT_VERIFY_FAILED
from planaveg_core.conferencia import Verificacao, verificar
from planaveg_core.config import Settings
from planaveg_core.contrato import carregar_contrato


def cmd_verify(settings: Settings, args: argparse.Namespace) -> int:
    contrato = carregar_contrato(settings.contract_path)
    with banco.conectar(settings) as con:
        entrega_id = banco.entrega_pronta(con)
        banco.conferir_contrato(con, entrega_id, contrato)
        with banco.registrar(
            con,
            etapas.VERIFY,
            entrega_id,
            detalhe={"geometrica": not args.rapido},
            vigentes=settings.vigentes,
        ) as info:
            resultados = verificar(con, entrega_id, contrato, geometrica=not args.rapido)
            aceitar = set(getattr(args, "aceitar", None) or ())
            placar = _placar(resultados, aceitar)
            info["reprovadas"] = placar.reprovadas
            info["aceitas"] = placar.aceitas
            info["erros"] = placar.erros
            info["puladas"] = placar.puladas
            info["resultados"] = {r.codigo: r.detalhe for r in resultados}
            info["dados"] = {r.codigo: r.dados for r in resultados if r.dados}
            # Reprovado só com reprovação não aceita; pulada não aprova nem reprova.
            info["ok"] = not placar.nao_aceitas
    for r in resultados:
        print(f"  {_situacao(r, aceitar)} {r.codigo:36} {r.detalhe}")
    print(_resumo(placar, len(resultados)))
    return EXIT_VERIFY_FAILED if placar.nao_aceitas else EXIT_OK


@dataclass(frozen=True)
class _Placar:
    aprovadas: int
    reprovadas: list[str]
    aceitas: list[str]
    erros: list[str]
    puladas: list[str]

    @property
    def nao_aceitas(self) -> list[str]:
        return [c for c in self.reprovadas if c not in self.aceitas]


def _placar(resultados: list[Verificacao], aceitar: set[str]) -> _Placar:
    """Separa os resultados. Uma conferência que deu erro não tem resultado para aceitar:
    reprova sempre, mesmo que o código dela esteja em `--aceitar`."""
    reprovadas = [r.codigo for r in resultados if not r.ok and not r.pulada]
    erros = [r.codigo for r in resultados if r.erro]
    return _Placar(
        aprovadas=sum(1 for r in resultados if r.ok),
        reprovadas=reprovadas,
        aceitas=[c for c in reprovadas if c in aceitar and c not in erros],
        erros=erros,
        puladas=[r.codigo for r in resultados if r.pulada],
    )


def _situacao(resultado: Verificacao, aceitar: set[str]) -> str:
    if resultado.ok:
        return "ok    "
    if resultado.pulada:
        return "PULADA"
    if resultado.erro:
        return "ERRO  "
    return "ACEITA" if resultado.codigo in aceitar else "FALHA "


def _contagem(n: int, singular: str, plural: str) -> str:
    """`1 reprovação aceita`, `2 reprovações aceitas`."""
    return f"{n} {singular if n == 1 else plural}"


def _resumo(placar: _Placar, total: int) -> str:
    """A última linha: "verify: 15/16 invariantes ok, 1 reprovação aceita"."""
    resumo = f"verify: {placar.aprovadas}/{total} invariantes ok"
    if placar.aceitas:
        resumo += ", " + _contagem(len(placar.aceitas), "reprovação aceita", "reprovações aceitas")
    if placar.erros:
        resumo += f", {len(placar.erros)} com erro do banco"
    if placar.puladas:
        resumo += ", " + _contagem(len(placar.puladas), "pulada", "puladas") + " (incompleto)"
    return resumo
