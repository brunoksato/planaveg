"""A organização do core: entre pacotes, só pelo `__init__` de cada um.

A ordem das camadas (quem pode importar quem) é do `import-linter` (`[tool.importlinter]` no
`pyproject.toml`, rodado por `make check`). Aqui fica a outra metade: um pacote só usa o que
outro reexporta no `__init__.py` (o `__all__`), nunca um módulo de dentro dele, em qualquer
forma de import (`from ... import`, `import ...` e os relativos). E o `_` é privado do arquivo,
como o Pylance o lê: um nome que outro módulo usa vai sem ele, e fica dentro do pacote por não
estar no `__all__`. Os testes podem ir além, porque provam também o que é interno.
"""

from __future__ import annotations

import ast
from functools import cache
from pathlib import Path

import pytest

RAIZ = Path(__file__).resolve().parents[1] / "src"


def _modulo(arquivo: Path) -> str:
    return ".".join(arquivo.relative_to(RAIZ).with_suffix("").parts).removesuffix(".__init__")


def _origem(base: list[str], no: ast.ImportFrom) -> str:
    """O módulo de onde um `from ... import` traz os nomes, absoluto (o relativo resolvido)."""
    if not no.level:
        return no.module or ""
    ancestral = base[: len(base) - (no.level - 1)]
    return ".".join([*ancestral, *(no.module.split(".") if no.module else [])])


def _importados(modulo: str, e_pacote: bool, codigo: str) -> list[tuple[str, tuple[str, ...]]]:
    """O que o código importa: o módulo, absoluto, e os nomes trazidos dele (nenhum num
    `import`)."""
    base = modulo.split(".") if e_pacote else modulo.split(".")[:-1]
    importados: list[tuple[str, tuple[str, ...]]] = []
    for no in ast.walk(ast.parse(codigo)):
        if isinstance(no, ast.Import):
            importados.extend((alias.name, ()) for alias in no.names)
        elif isinstance(no, ast.ImportFrom):
            importados.append((_origem(base, no), tuple(a.name for a in no.names)))
    return importados


@cache
def _exportados() -> dict[str, frozenset[str]]:
    """O `__all__` do `__init__.py` de cada pacote do core, lido sem importá-lo."""
    exportados: dict[str, frozenset[str]] = {}
    for init in (RAIZ / "planaveg_core").glob("*/__init__.py"):
        for no in ast.parse(init.read_text(encoding="utf-8")).body:
            if isinstance(no, ast.Assign) and any(
                isinstance(alvo, ast.Name) and alvo.id == "__all__" for alvo in no.targets
            ):
                exportados[f"planaveg_core.{init.parent.name}"] = frozenset(
                    ast.literal_eval(no.value)
                )
    return exportados


def _pacotes_importados(modulo: str, e_pacote: bool, codigo: str) -> dict[str, str]:
    """Os pacotes do core importados como nome (`from planaveg_core import banco`, também o
    relativo): o nome no código → o pacote."""
    pacotes: dict[str, str] = {}
    base = modulo.split(".") if e_pacote else modulo.split(".")[:-1]
    for no in ast.walk(ast.parse(codigo)):
        if isinstance(no, ast.ImportFrom) and _origem(base, no) == "planaveg_core":
            for alias in no.names:
                if f"planaveg_core.{alias.name}" in _exportados():
                    pacotes[alias.asname or alias.name] = f"planaveg_core.{alias.name}"
    return pacotes


def _atalhos(modulo: str, e_pacote: bool, codigo: str) -> list[str]:
    """O que um módulo traz de outro pacote sem passar pelo `__init__` dele: um módulo de dentro
    (`planaveg_core.<pacote>.<módulo>`), ou um nome que o `__init__` não exporta, importado (o
    Python importa um submódulo mesmo assim: `from planaveg_core.banco import vigentes`) ou lido
    do pacote (`banco.vigentes`, que funciona se outro módulo já carregou o submódulo)."""
    pacote = modulo.split(".")[1] if "." in modulo else ""
    atalhos = []
    for origem, nomes in _importados(modulo, e_pacote, codigo):
        partes = origem.split(".")
        if partes[0] != "planaveg_core" or len(partes) < 2 or partes[1] == pacote:
            continue
        if len(partes) >= 3:
            atalhos.append(f"{modulo} importa {origem}")
        elif origem in _exportados():
            fora = [n for n in nomes if n not in _exportados()[origem]]
            atalhos += [f"{modulo} importa {origem}.{n}, que o __init__ não exporta" for n in fora]
    pacotes = _pacotes_importados(modulo, e_pacote, codigo)
    for no in ast.walk(ast.parse(codigo)):
        if isinstance(no, ast.Attribute) and isinstance(no.value, ast.Name):
            origem = pacotes.get(no.value.id, "")
            if origem and origem.split(".")[1] != pacote and no.attr not in _exportados()[origem]:
                atalhos.append(f"{modulo} lê {origem}.{no.attr}, que o __init__ não exporta")
    return atalhos


def _privado(nome: str) -> bool:
    return nome.startswith("_") and not nome.startswith("__")


def _privados_de_fora(modulo: str, e_pacote: bool, codigo: str) -> list[str]:
    """Os nomes com `_` que o módulo traz de outro módulo do core: importados
    (`from planaveg_core.banco.conexao import _executar`) ou lidos por atributo de um módulo
    importado (`conexao._executar`)."""
    achados = [
        f"{modulo} importa {origem}.{nome}"
        for origem, nomes in _importados(modulo, e_pacote, codigo)
        if origem.startswith("planaveg_core") and origem != modulo
        for nome in nomes
        if _privado(nome)
    ]
    base = modulo.split(".") if e_pacote else modulo.split(".")[:-1]
    do_core: set[str] = set()
    for no in ast.walk(ast.parse(codigo)):
        if isinstance(no, ast.ImportFrom) and _origem(base, no).startswith("planaveg_core"):
            do_core.update(alias.asname or alias.name for alias in no.names)
        elif isinstance(no, ast.Import):
            do_core.update(
                alias.asname or alias.name.split(".")[0]
                for alias in no.names
                if alias.name.startswith("planaveg_core")
            )
    achados += [
        f"{modulo} lê {no.value.id}.{no.attr}"
        for no in ast.walk(ast.parse(codigo))
        if isinstance(no, ast.Attribute)
        and isinstance(no.value, ast.Name)
        and no.value.id in do_core
        and _privado(no.attr)
    ]
    return achados


def test_nome_com_sublinhado_fica_no_proprio_modulo() -> None:
    achados = []
    for arquivo in sorted((RAIZ / "planaveg_core").rglob("*.py")):
        codigo = arquivo.read_text(encoding="utf-8")
        achados += _privados_de_fora(_modulo(arquivo), arquivo.name == "__init__.py", codigo)
    assert achados == []


@pytest.mark.parametrize(
    ("codigo", "privado"),
    [
        ("from planaveg_core.banco.conexao import _executar", True),
        ("from .recursos import _caixas", True),
        ("from planaveg_core.cache import semeadura\nsemeadura._ATIVA", True),
        ("from planaveg_core.banco.conexao import executar_script", False),
        ("from planaveg_core.cache import semeadura\nsemeadura.plano", False),
        ("import planaveg_core\nplanaveg_core.__version__", False),
    ],
)
def test_sublinhado_em_toda_forma_de_uso(codigo: str, privado: bool) -> None:
    # Como se o código estivesse em `geoserver/publicar.py`.
    assert bool(_privados_de_fora("planaveg_core.geoserver.publicar", False, codigo)) is privado


def test_todo_pacote_diz_o_que_exporta() -> None:
    """Sem `__all__`, um pacote ficaria fora da regra dos nomes exportados."""
    pacotes = {
        f"planaveg_core.{p.parent.name}" for p in (RAIZ / "planaveg_core").glob("*/__init__.py")
    }
    assert pacotes == set(_exportados())


def test_pacotes_se_importam_so_pelo_init() -> None:
    atalhos = []
    for arquivo in sorted((RAIZ / "planaveg_core").rglob("*.py")):
        codigo = arquivo.read_text(encoding="utf-8")
        atalhos += _atalhos(_modulo(arquivo), arquivo.name == "__init__.py", codigo)
    assert atalhos == []


@pytest.mark.parametrize(
    ("codigo", "atalho"),
    [
        ("from planaveg_core.cache.gwc import Caixa", True),
        ("import planaveg_core.cache.gwc", True),
        ("from ..cache.gwc import Caixa", True),
        ("from ..cache import gwc", False),
        ("from planaveg_core.cache import gwc", False),
        # Um submódulo que o `__init__` não exporta também é um atalho.
        ("from planaveg_core.banco import vigentes", True),
        ("from ..banco import registrar, vigentes", True),
        ("from planaveg_core.banco import registrar", False),
        ("from .. import banco", False),
        # E lido do pacote por atributo, que funciona se outro módulo já carregou o submódulo.
        ("from planaveg_core import banco\nbanco.vigentes.sincronizar()", True),
        ("from .. import banco as b\nb.vigentes", True),
        ("from planaveg_core import banco\nbanco.registrar()", False),
        ("from planaveg_core import cache\ncache.gwc.Caixa", False),
        ("from .versoes import calcular_versoes", False),
        ("from . import versoes", False),
        ("import planaveg_core", False),
    ],
)
def test_atalhos_em_toda_forma_de_import(codigo: str, atalho: bool) -> None:
    # Como se o código estivesse em `geoserver/publicar.py`.
    assert bool(_atalhos("planaveg_core.geoserver.publicar", False, codigo)) is atalho
