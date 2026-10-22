"""O histórico das publicações: cada publicação que mudou os dados (a `versao_dados`), com a
entrega, o contrato e as versões, e os números que ela pôs no ar (`resultado_*`).

O que a base anterior mostrava some com a carga seguinte, e o arquivo dela pode nem voltar. Os
números ficam aqui, pequenos: o cômputo por linha da hierarquia, a série de todos os recortes e as
facetas, de onde o portal tira qualquer total do Brasil. O contrato de cada um está em
`contrato_versao`.
"""

from __future__ import annotations

from uuid import UUID

import psycopg

from planaveg_core.errors import PlanavegError

_RESULTADOS = (
    """
    INSERT INTO resultado_nivel (publicacao_id, ano_vs, tier, categoria, n_pecas, area_ha,
                                 computo_recebido_ha, area_calculada_ha)
    SELECT %(publicacao)s, ano_vs, tier, categoria, n_pecas, area_ha, computo_recebido_ha,
           area_calculada_ha
    FROM quantitativo_nivel
    """,
    """
    INSERT INTO resultado_serie (publicacao_id, recorte, chave, rotulo, ano_vs, area_ha)
    SELECT %(publicacao)s, recorte, chave, rotulo, ano_vs, area_ha FROM serie
    """,
    """
    INSERT INTO resultado_faceta (publicacao_id, ano_vs, nivel, categoria, arranjo, uf, bioma,
                                  temas, esferas_uc, tipos_uc, n_pecas, n_poligonos, area_ha)
    SELECT %(publicacao)s, ano_vs, nivel, categoria, arranjo, uf, bioma, temas, esferas_uc,
           tipos_uc, n_pecas, n_poligonos, area_ha
    FROM quantitativo_faceta
    """,
)


def registrar_publicacao(
    con: psycopg.Connection,
    entrega_id: UUID,
    contrato_versao_id: int,
    versoes: tuple[str, str],
) -> int | None:
    """Guarda a publicação e os números dela, se a versão dos dados mudou desde a última.
    Devolve o id, ou None quando nada mudou. `versoes`: a do mapa e a dos dados."""
    versao_mapa, versao_dados = versoes
    ultima = con.execute("SELECT versao_dados FROM publicacao ORDER BY id DESC LIMIT 1").fetchone()
    if ultima is not None and ultima[0] == versao_dados:
        return None
    linha = con.execute(
        """
        INSERT INTO publicacao (entrega_id, contrato_versao_id, versao_mapa, versao_dados,
                                publicada_em)
        VALUES (%s, %s, %s, %s, clock_timestamp())
        RETURNING id
        """,
        (entrega_id, contrato_versao_id, versao_mapa, versao_dados),
    ).fetchone()
    if linha is None:
        raise PlanavegError("publicacao_nao_registrada")
    publicacao_id = int(linha[0])
    for comando in _RESULTADOS:
        con.execute(comando, {"publicacao": publicacao_id})
    return publicacao_id
