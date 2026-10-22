"""As versões vigentes num diretório, para o nginx: um arquivo vazio por versão que a
`fonte_vigente` publica.

Uma URL com versão fica um ano em cache. Isso só é seguro se a versão é a vigente: uma sessão do
portal aberta antes de uma base nova continua pedindo com a versão antiga, e, se a resposta (com
os dados novos) ficasse um ano em cache sob ela, outras sessões antigas veriam dados de outra
base. O nginx (`infra/producao/nginx.conf`) só dá um ano à URL cujo `v` tem arquivo aqui; as
outras ficam um minuto.

O diretório espelha a `fonte_vigente` e é refeito ao abrir e ao fechar cada etapa registrada:
uma etapa que mexe nos dados o esvazia ao começar, e a publicação seguinte o preenche. As corridas
entre etapas são as que a `fonte_vigente` já resolve.
"""

from __future__ import annotations

import logging
import re
from pathlib import Path

import psycopg

_LOG = logging.getLogger("planaveg_core.postgres")
_VERSAO = re.compile(r"^[0-9a-f]{16}$")


def vigentes(con: psycopg.Connection) -> set[str]:
    """As versões que a `fonte_vigente` publica agora (nenhuma durante uma atualização)."""
    linha = con.execute("SELECT versao_mapa, versao_dados FROM fonte_vigente").fetchone()
    if linha is None:
        return set()
    return {str(v) for v in linha if v is not None and _VERSAO.fullmatch(str(v))}


def sincronizar(con: psycopg.Connection, pasta: Path) -> set[str]:
    """Deixa em `pasta` um arquivo por versão vigente e apaga os de versões que deixaram de ser.

    Só mexe nos arquivos com nome de versão: um arquivo de outro dono na mesma pasta fica. Uma
    `fonte_vigente` que ainda não existe, ou de outra versão do core, sem estas colunas (o
    `init-db` a refaz), vale como nenhuma versão vigente: o lado seguro, e o `init-db` roda.
    """
    try:
        atuais = vigentes(con)
    except (psycopg.errors.UndefinedTable, psycopg.errors.UndefinedColumn):
        con.rollback()
        atuais = set()
    pasta.mkdir(parents=True, exist_ok=True)
    for arquivo in pasta.iterdir():
        if arquivo.is_file() and _VERSAO.fullmatch(arquivo.name) and arquivo.name not in atuais:
            arquivo.unlink()
    for versao in atuais:
        (pasta / versao).touch()
    _LOG.info("versões vigentes para o nginx: %s", ", ".join(sorted(atuais)) or "nenhuma")
    return atuais
