"""`init-db`: cria ou atualiza a estrutura do banco."""

from __future__ import annotations

import argparse

from planaveg_core import banco, etapas
from planaveg_core.cli.codigos import EXIT_OK
from planaveg_core.config import Settings
from planaveg_core.contrato import carregar_contrato


def cmd_init_db(settings: Settings, args: argparse.Namespace) -> int:
    contrato = carregar_contrato(settings.contract_path)
    with banco.conectar(settings) as con:
        # Antes de abrir a etapa, que precisa da tabela execucao: as migrações que faltam.
        migracoes = banco.preparar(con)
        con.commit()
        with banco.registrar(
            con,
            etapas.INIT_DB,
            detalhe={"recreate": args.recreate, "migracoes": migracoes},
            vigentes=settings.vigentes,
        ) as info:
            info["contrato_versao"] = banco.aplicar_estrutura(
                con, contrato, settings.geoserver_pg_password, recriar=args.recreate
            )
            info["contrato"] = contrato.schema_version
            info["filtros"] = len(contrato.filtros)
            info["arranjos"] = len(contrato.arranjos)
    modo = "carga descartada" if args.recreate else "carga preservada"
    aplicadas = f"migrações aplicadas: {', '.join(migracoes)}; " if migracoes else ""
    print(f"banco inicializado no schema public: {aplicadas}regras e views geradas; {modo}")
    return EXIT_OK
