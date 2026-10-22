"""`load`: carrega as peças do arquivo."""

from __future__ import annotations

import argparse
import logging

import psycopg
from psycopg import sql

from planaveg_core import banco, etapas, gpkg
from planaveg_core.carga import carregar
from planaveg_core.cli.codigos import EXIT_OK
from planaveg_core.config import Settings
from planaveg_core.contrato import carregar_contrato

_LOG = logging.getLogger("planaveg_core.load")


def cmd_load(settings: Settings, _args: argparse.Namespace) -> int:
    contrato = carregar_contrato(settings.contract_path)
    recipiente = gpkg.inspecionar(settings.arquivo_gpkg(contrato.arquivo_referencia), contrato)
    with banco.conectar(settings) as con:
        # Antes de abrir a etapa, que tiraria as versões vigentes: o banco tem a estrutura deste
        # core e as regras deste contrato (senão, init-db).
        banco.conferir_migracoes(con)
        banco.conferir_contrato_vigente(con, contrato)
        with banco.registrar(
            con,
            etapas.LOAD,
            detalhe={"arquivo": recipiente.caminho.name},
            vigentes=settings.vigentes,
        ) as info:
            # Uma transação só: as peças, as views materializadas e o fim do registro. Quem lê vê
            # a base anterior até aqui, e uma falha desfaz tudo.
            info.update(carregar(con, contrato, recipiente, info))
            info["quantitativos_atualizados"] = banco.atualizar_quantitativos(con, contrato)
    print(
        f"carga concluida entrega_id={info['entrega_id']} "
        f"pecas={info['registros_carregados']} "
        f"rejeitadas={info['registros_rejeitados']} em {info['duracao_s']}s"
    )
    _vacuum(settings)
    return EXIT_OK


def _vacuum(settings: Settings) -> None:
    """Recolhe as linhas que o DELETE da carga deixou, fora da transação (o VACUUM não roda
    dentro de uma). A carga já está confirmada: uma falha aqui só avisa, e o autovacuum as
    recolhe depois."""
    _LOG.info("VACUUM ANALYZE das tabelas da carga (as linhas da base anterior)")
    try:
        with banco.conectar(settings) as con:
            con.commit()  # `conectar` já abriu uma transação com os SET da sessão
            con.autocommit = True
            con.execute(sql.SQL("VACUUM ANALYZE {}").format(banco.lista_da_carga()))
    except psycopg.Error as exc:
        _LOG.warning("o VACUUM depois da carga falhou (%s); a carga está feita", exc)
