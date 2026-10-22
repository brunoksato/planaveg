"""As migrações (`sql/migracoes/`): a estrutura das tabelas, numerada e só para a frente.

Cada arquivo `NNNN_nome.sql` roda uma vez, na ordem, e fica registrado em `migracao` com o
SHA-256 dele. Uma migração aplicada não muda mais: se o arquivo mudou, o `init-db` para. As views,
as funções e as linhas das regras não são migradas, porque o `init-db` as refaz a cada vez.
"""

from __future__ import annotations

import hashlib
import re
from dataclasses import dataclass
from importlib.resources import files

import psycopg
from psycopg import sql

from planaveg_core.banco.conexao import executar
from planaveg_core.errors import PlanavegError

_NOME = re.compile(r"^(\d{4})_([a-z0-9_]+)\.sql$")


@dataclass(frozen=True)
class Migracao:
    numero: int
    nome: str
    texto: str

    @property
    def sha256(self) -> str:
        return hashlib.sha256(self.texto.encode("utf-8")).hexdigest()


def migracoes() -> list[Migracao]:
    """As migrações do pacote, em ordem. Os números começam em 1 e não pulam."""
    lista = []
    for arquivo in files("planaveg_core").joinpath("sql", "migracoes").iterdir():
        achado = _NOME.fullmatch(arquivo.name)
        if achado is None:
            raise PlanavegError("migracao_com_nome_invalido", arquivo.name)
        lista.append(Migracao(int(achado.group(1)), achado.group(2), arquivo.read_text("utf-8")))
    lista.sort(key=lambda m: m.numero)
    if [m.numero for m in lista] != list(range(1, len(lista) + 1)):
        raise PlanavegError("migracoes_fora_de_sequencia", ", ".join(str(m.numero) for m in lista))
    return lista


def _aplicadas(con: psycopg.Connection) -> dict[int, str]:
    """O número e o SHA-256 de cada migração já aplicada; vazio num banco sem o registro."""
    if con.execute("SELECT to_regclass('migracao') IS NULL").fetchone() == (True,):
        return {}
    return {
        int(numero): str(sha)
        for numero, sha in con.execute("SELECT numero, sha256 FROM migracao").fetchall()
    }


def pendentes(con: psycopg.Connection) -> list[Migracao]:
    """As que faltam aplicar. Falha fechado se uma aplicada mudou ou não existe no pacote: o
    banco é de outra versão do core."""
    aplicadas = _aplicadas(con)
    todas = migracoes()
    conhecidas = {m.numero for m in todas}
    desconhecidas = sorted(n for n in aplicadas if n not in conhecidas)
    if desconhecidas:
        raise PlanavegError(
            "banco_de_versao_mais_nova", f"migrações {desconhecidas} não existem neste core"
        )
    alteradas = [
        m.numero for m in todas if m.numero in aplicadas and aplicadas[m.numero] != m.sha256
    ]
    if alteradas:
        raise PlanavegError(
            "migracao_alterada", f"migrações {alteradas} mudaram depois de aplicadas"
        )
    return [m for m in todas if m.numero not in aplicadas]


def registro(migracao: Migracao) -> sql.Composed:
    """A linha da migração em `migracao`. O `init-db` a grava ao aplicá-la, e a `modelagem` a
    escreve logo depois das tabelas: um banco criado pelos arquivos fica igual ao do `init-db`."""
    return sql.SQL("INSERT INTO migracao (numero, nome, sha256) VALUES ({}, {}, {})").format(
        sql.Literal(migracao.numero), sql.Literal(migracao.nome), sql.Literal(migracao.sha256)
    )


def aplicar_migracoes(con: psycopg.Connection) -> list[str]:
    """Aplica as pendentes, na ordem, na transação de quem chama. Devolve os nomes."""
    aplicadas = []
    for migracao in pendentes(con):
        executar(con, migracao.texto)
        con.execute(registro(migracao))
        aplicadas.append(f"{migracao.numero:04d}_{migracao.nome}")
    return aplicadas


def conferir_migracoes(con: psycopg.Connection) -> None:
    """O banco tem a estrutura deste core. Sem isso, a etapa para e manda rodar o `init-db`."""
    faltam = pendentes(con)
    if faltam:
        nomes = ", ".join(f"{m.numero:04d}_{m.nome}" for m in faltam)
        raise PlanavegError("banco_desatualizado", f"faltam as migrações {nomes}: rode init-db")
