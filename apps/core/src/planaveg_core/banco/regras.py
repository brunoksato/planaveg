"""As regras e os lugares de referência no banco: o contrato vigente (`contrato_versao`) e as
tabelas `contrato_*`, `camada_publicada` e `lugar_municipio`, acertadas no lugar pelo `init-db`.

O SQL de cada tabela sai da `publicacao` (`referencia.py`). Aqui fica a ordem: as refeitas saem, as
mantidas são atualizadas, as linhas que saíram do contrato saem das mantidas e as refeitas entram
de novo. Uma linha que saiu mas que a carga usa faz o `init-db` parar: a carga tem de ir antes
(`init-db --recreate` e `load`).
"""

from __future__ import annotations

import psycopg
from psycopg import sql
from psycopg.types.json import Jsonb

from planaveg_core.contrato import Contrato
from planaveg_core.errors import PlanavegError
from planaveg_core.publicacao import MANTIDAS, REFEITAS, View, dados_de_referencia, remocoes


def registrar_contrato(con: psycopg.Connection, contrato: Contrato) -> int:
    """Guarda a versão do contrato (pela impressão do JSON) e a torna a vigente. Devolve o id."""
    linha = con.execute(
        """
        INSERT INTO contrato_versao (impressao, versao, impressao_carga, conteudo)
        VALUES (%s, %s, %s, %s)
        ON CONFLICT (impressao) DO UPDATE SET versao = EXCLUDED.versao
        RETURNING id
        """,
        (
            contrato.impressao(),
            contrato.schema_version,
            contrato.impressao_da_carga(),
            Jsonb(dict(contrato.bruto)),
        ),
    ).fetchone()
    if linha is None:
        raise PlanavegError("contrato_nao_registrado")
    versao_id = int(linha[0])
    # Em dois passos: o índice de uma vigente só não aceita duas, nem por um instante.
    con.execute(
        "UPDATE contrato_versao SET vigente = false WHERE vigente AND id <> %s", (versao_id,)
    )
    con.execute("UPDATE contrato_versao SET vigente = true WHERE id = %s", (versao_id,))
    return versao_id


def conferir_contrato_vigente(con: psycopg.Connection, contrato: Contrato) -> int:
    """O contrato configurado é o que as tabelas trazem. Falha fechado: uma etapa com outro
    contrato publicaria regras que o banco não tem. Devolve o id da versão."""
    linha = con.execute("SELECT id, impressao FROM contrato_versao WHERE vigente").fetchone()
    if linha is None:
        raise PlanavegError("contrato_nao_aplicado", "rode init-db")
    versao_id, impressao = int(linha[0]), str(linha[1])
    if impressao != contrato.impressao():
        raise PlanavegError(
            "contrato_mudou", "o contrato configurado não é o do último init-db: rode init-db"
        )
    return versao_id


def gravar_regras(con: psycopg.Connection, contrato: Contrato, geradas: list[View]) -> None:
    """Acerta as tabelas das regras e dos municípios com o contrato e o arquivo do IBGE."""
    dados = dados_de_referencia(contrato, geradas)
    for tabela in reversed(REFEITAS):
        con.execute(sql.SQL("DELETE FROM {}").format(sql.Identifier(tabela.nome)))
    for tabela in MANTIDAS:
        if tabela.nome in dados:
            _executar_mudando_chave(con, tabela.nome, dados[tabela.nome])
    for nome, comando in remocoes(contrato):
        _executar_mudando_chave(con, nome, comando)
    for tabela in REFEITAS:
        if tabela.nome in dados:
            con.execute(dados[tabela.nome])


def _executar_mudando_chave(con: psycopg.Connection, tabela: str, comando: sql.Composed) -> None:
    """Um comando numa mantida. Se ele tira ou troca uma linha que a carga usa, o `init-db` para
    com o que falta: a carga com as regras novas vem antes."""
    try:
        with con.transaction():
            con.execute(comando)
    except (psycopg.errors.ForeignKeyViolation, psycopg.errors.UniqueViolation) as exc:
        raise PlanavegError(
            "contrato_tira_o_que_a_carga_usa",
            f"{tabela}: {exc.diag.message_detail or exc.diag.message_primary}; "
            "rode init-db --recreate (apaga a carga) e depois load",
        ) from exc
