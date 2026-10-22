"""A carga das peças: cada camada lida do SQLite em lotes, copiada (`COPY`), conferida e inserida
em `peca_recebida`, `peca_marca` e `peca_geometria`, esta com as geometrias do mapa.
"""

from __future__ import annotations

import logging
import sqlite3
from collections import Counter
from contextlib import closing
from typing import Any
from uuid import UUID

import psycopg
from psycopg import sql
from psycopg.types.json import Jsonb

from planaveg_core import gpkg
from planaveg_core.banco import (
    CONFERENCIAS,
    LUGARES,
    MESOBACIA_EM_OUTRA_REGIAO,
    NOMES_DE_MUNICIPIO,
    POUSO,
    TABELAS_DA_CARGA,
    computo,
    computo_divergente,
    conferir_contrato_vigente,
    insercao_das_pecas,
    lista_da_carga,
)
from planaveg_core.carga.conversores import Leitor, ValorInvalido, ValorNaoFinito, para_bigint
from planaveg_core.carga.entrega import registrar_entrega, sha256_arquivo
from planaveg_core.contrato import Camada, Contrato
from planaveg_core.errors import PlanavegError

_LOG = logging.getLogger("planaveg_core.load")

_LOTE = 1000  # peças por COPY: as maiores têm 17 MB de WKB


def _wkb_da_linha(geom: object, camada: Camada, srid: int) -> bytes | None:
    """WKB puro do blob GeoPackage, ou None para geometria ausente ou vazia."""
    if geom is None:
        return None
    if not isinstance(geom, bytes):
        raise PlanavegError("geometria_binaria_invalida", camada.origem)
    geometria = gpkg.ler_geometria(geom)
    if geometria.srs_id != srid:
        raise PlanavegError(
            "geometria_srs_divergente", f"{camada.origem}: blob={geometria.srs_id} camada={srid}"
        )
    return geometria.wkb or None


def _falhar_se_achar(
    con: psycopg.Connection,
    codigo: str,
    consulta: str | sql.Composed,
    parametros: dict[str, Any] | None = None,
) -> None:
    """Para a carga com `codigo` se a consulta acha casos (até três, no detalhe)."""
    casos = [str(r[0]) for r in con.execute(consulta, parametros).fetchall()]
    if casos:
        raise PlanavegError(codigo, ", ".join(casos))


def _gravar_lote(
    con: psycopg.Connection, parametros: dict[str, Any], nomes: dict[str, tuple[str, str]]
) -> None:
    """Confere o lote que está no pouso, guarda as bacias e o cômputo dele e grava as peças. Os
    nomes de município que não são os do IBGE vão para `nomes`."""
    entrega, ano = sql.Placeholder("entrega"), sql.Placeholder("ano")
    for codigo, consulta in CONFERENCIAS:
        _falhar_se_achar(con, codigo, consulta)
    for comando in LUGARES:
        con.execute(comando)
    _falhar_se_achar(con, "mesobacia_em_duas_regioes", MESOBACIA_EM_OUTRA_REGIAO)
    con.execute(computo(entrega, ano), parametros)
    _falhar_se_achar(con, "computo_recebido_diverge", computo_divergente(entrega, ano), parametros)
    for cod, arquivo, ibge in con.execute(NOMES_DE_MUNICIPIO).fetchall():
        nomes[str(cod)] = (str(arquivo), str(ibge))
    con.execute(insercao_das_pecas(entrega, ano), parametros)


def _carregar_camada(
    con: psycopg.Connection,
    sqlite: sqlite3.Connection,
    contrato: Contrato,
    camada: Camada,
    entrega_id: UUID,
) -> dict[str, Any]:
    """SQLite → COPY em pg_temp.pouso → as tabelas da peça, em lotes; devolve o que o verify
    confere, que também fica em `entrega_camada`.

    O pouso (`banco.POUSO`) tem as colunas do modelo, as marcas numa lista, o `origem_id` e o
    WKB, sem índice. Cada lote é conferido e vai às tabelas da peça pelo INSERT de
    `banco.insercao_das_pecas`, o mesmo que a modelagem escreve: nada é reparado, e uma
    geometria inválida no Albers chega ao `verify`, que a aponta. Geometria vazia não entra: vira
    `vazias`.
    """
    colunas_sqlite = ", ".join(gpkg.sqlite_ident(c.origem) for c in contrato.colunas)
    pk = gpkg.sqlite_ident(contrato.coluna_pk)
    geom_sqlite = gpkg.sqlite_ident(contrato.coluna_geom)
    # SQLite não compõe identificadores; sqlite_ident valida e cita cada nome do contrato.
    origem_sqlite = f"{gpkg.sqlite_ident(camada.origem)} ORDER BY {pk}"
    consulta = f"SELECT {pk}, {colunas_sqlite}, {geom_sqlite} FROM {origem_sqlite}"  # noqa: S608  # nosec B608
    # A contagem do arquivo, à parte da leitura em lotes: o `verify` confere que o arquivo tem
    # o que a carga leu (gravadas mais vazias).
    contar = f"SELECT count(*) FROM {gpkg.sqlite_ident(camada.origem)}"  # noqa: S608  # nosec B608
    linha_total = sqlite.execute(contar).fetchone()
    no_arquivo = int(linha_total[0]) if linha_total is not None else -1

    con.execute("DROP TABLE IF EXISTS pg_temp.pouso")
    con.execute(POUSO)
    con.execute(
        """
        INSERT INTO entrega_camada (entrega_id, ano_vs, camada, feicoes, lidas, carregadas,
                                    vazias, area_ha)
        VALUES (%s, %s, %s, %s, 0, 0, 0, 0)
        ON CONFLICT (entrega_id, ano_vs) DO UPDATE
        SET camada = EXCLUDED.camada, feicoes = EXCLUDED.feicoes, lidas = 0, carregadas = 0,
            vazias = 0, anuladas = '{}'::jsonb, area_ha = 0
        """,
        (entrega_id, camada.ano_vs, camada.origem, max(no_arquivo, 0)),
    )
    parametros = {"entrega": entrega_id, "ano": camada.ano_vs}
    leitor = Leitor(contrato)
    anulados: Counter[str] = Counter()
    nomes: dict[str, tuple[str, str]] = {}
    lidas = 0
    vazias = 0
    rows = sqlite.execute(consulta)
    try:
        while lote := rows.fetchmany(_LOTE):
            # As colunas do pouso, na ordem: o fid, as do modelo, as marcas e o WKB.
            with con.cursor() as cur, cur.copy("COPY pg_temp.pouso FROM STDIN") as copy:
                for linha in lote:
                    wkb = _wkb_da_linha(linha[-1], camada, contrato.srid)
                    if wkb is None:
                        vazias += 1
                    try:
                        origem_id = para_bigint(linha[0])
                    except (ValorInvalido, ValorNaoFinito) as exc:
                        raise PlanavegError("fid_invalido", camada.origem) from exc
                    atributos, marcas = leitor.ler(linha[1:-1], anulados)
                    copy.write_row([origem_id, *atributos, marcas, wkb])
            _gravar_lote(con, parametros, nomes)
            con.execute("TRUNCATE pg_temp.pouso")
            lidas += len(lote)
            _LOG.info("camada=%s lidas=%s", camada.origem, lidas)
    finally:
        rows.close()

    linha_contagem = con.execute(
        "SELECT count(*), coalesce(sum(area_ha), 0) FROM peca_recebida "
        "WHERE entrega_id = %s AND ano_vs = %s",
        (entrega_id, camada.ano_vs),
    ).fetchone()
    if linha_contagem is None:
        raise PlanavegError("contagem_origem_indisponivel", camada.origem)
    persistidas, area = int(linha_contagem[0]), float(linha_contagem[1])
    con.execute("DROP TABLE pg_temp.pouso")
    con.execute(
        """
        UPDATE entrega_camada
        SET lidas = %s, carregadas = %s, vazias = %s, anuladas = %s, area_ha = %s
        WHERE entrega_id = %s AND ano_vs = %s
        """,
        (lidas, persistidas, vazias, Jsonb(dict(anulados)), area, entrega_id, camada.ano_vs),
    )
    rejeitadas = lidas - persistidas
    _LOG.info(
        "camada=%s ano_vs=%s lidas=%s persistidas=%s rejeitadas=%s vazias=%s",
        camada.origem,
        camada.ano_vs,
        lidas,
        persistidas,
        rejeitadas,
        vazias,
    )
    if anulados:
        _LOG.warning(
            "camada=%s valores anulados por nao converterem: %s", camada.origem, dict(anulados)
        )
    if nomes:
        _LOG.warning(
            "camada=%s %s municípios com outro nome no arquivo; o publicado é o do IBGE",
            camada.origem,
            len(nomes),
        )
    return {
        "ano_vs": camada.ano_vs,
        "gpkg": no_arquivo,
        "lidas": lidas,
        "carregados": persistidas,
        "rejeitados": rejeitadas,
        "vazias": vazias,
        "anulados": dict(anulados),
        "area_ha": area,
        "municipios_com_outro_nome": {c: list(n) for c, n in sorted(nomes.items())},
    }


def carregar(
    con: psycopg.Connection,
    contrato: Contrato,
    recipiente: gpkg.Recipiente,
    info: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Carrega as camadas numa transação só, que quem chama confirma. Devolve o `detalhe`.

    Quem lê (o GeoServer) continua vendo a base anterior até o commit, e uma falha desfaz tudo:
    a entrega anterior continua pronta, com as suas peças. Por isso as peças anteriores saem com
    DELETE: o TRUNCATE bloquearia a leitura até o fim da carga. `info`
    recebe a entrega logo que ela é registrada, para o registro da etapa guardá-la mesmo se a
    carga falhar.
    """
    versao_id = conferir_contrato_vigente(con, contrato)
    sha256, tamanho = sha256_arquivo(recipiente.caminho)
    fingerprint_ok = contrato.sha256 is None or contrato.sha256 == sha256
    if not fingerprint_ok:
        _LOG.warning(
            "sha256 diverge do fingerprint do contrato; a carga continua neste planaveg_core"
        )
    entrega_id = registrar_entrega(con, versao_id, recipiente, sha256, tamanho)
    if info is not None:
        info["entrega_id"] = str(entrega_id)
    for tabela in TABELAS_DA_CARGA:
        con.execute(sql.SQL("DELETE FROM {}").format(sql.Identifier(tabela)))
    camadas: dict[str, dict[str, Any]] = {}
    with closing(gpkg.abrir(recipiente.caminho)) as sqlite:
        for camada in contrato.camadas:
            camadas[camada.origem] = _carregar_camada(con, sqlite, contrato, camada, entrega_id)
    con.execute(sql.SQL("ANALYZE {}").format(lista_da_carga()))
    # O fim de verdade: now() seria o início da transação, que é o da carga inteira.
    con.execute(
        "UPDATE entrega SET concluida_em = clock_timestamp(), estado = 'pronta' WHERE id = %s",
        (entrega_id,),
    )
    return {
        "entrega_id": str(entrega_id),
        "sha256": sha256,
        "fingerprint_ok": fingerprint_ok,
        "registros_carregados": sum(c["carregados"] for c in camadas.values()),
        "registros_rejeitados": sum(c["rejeitados"] for c in camadas.values()),
        "valores_anulados": sum(sum(c["anulados"].values()) for c in camadas.values()),
        # Por camada: o que o `status` mostra (o verify lê `entrega_camada`).
        "camadas": camadas,
    }
