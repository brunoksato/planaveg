"""A modelagem: o banco que o `init-db` cria, em quatro arquivos de SQL puro, na ordem de aplicar.

Cada arquivo junta o que o `init-db` roda, na mesma ordem: os scripts como estão, com os
comentários, e os comandos que o código monta.

- `1_tabelas.sql`: os scripts da base (a extensão PostGIS, o SRS do GeoPackage e os registros) e
  as migrações (as tabelas, as UFs e os biomas), cada uma registrada como aplicada.
- `2_funcoes.sql`: as funções que a carga e as views chamam.
- `3_views.sql`: as views geradas do contrato, na ordem de criação, registradas em
  `objeto_gerado`, e o papel de leitura do GeoServer com as permissões dele. As materializadas
  nascem vazias.
- `4_dados.sql`: a versão do contrato, as regras e os municípios do IBGE em linhas, as chaves das
  camadas e o primeiro cálculo das materializadas.

Aplicados num banco PostGIS vazio, dão o banco do `init-db`, com os mesmos registros: o `load`
carrega as peças nele, e um `init-db` depois o atualiza. Fica de fora a senha do papel de leitura.
"""

from __future__ import annotations

from textwrap import dedent

from psycopg import sql
from psycopg.types.json import Jsonb

from planaveg_core.banco.estrutura import (
    SCRIPT_FUNCOES,
    SCRIPTS_BASE,
    chaves,
    registro_das_geradas,
    script,
)
from planaveg_core.banco.migracoes import migracoes, registro
from planaveg_core.banco.papel import concessoes, papel_sem_senha
from planaveg_core.contrato import Contrato
from planaveg_core.publicacao import View, dados_de_referencia, views


def modelagem(contrato: Contrato) -> dict[str, str]:
    """O texto de cada arquivo, pelo nome."""
    geradas = views(contrato)
    todas = migracoes()
    dados = [
        _versao_do_contrato(contrato),
        *dados_de_referencia(contrato, geradas).values(),
        *chaves(geradas),
        *(v.preencher() for v in geradas if v.materializada),
    ]
    return {
        "1_tabelas.sql": _arquivo(
            contrato,
            "Aplique os arquivos na ordem dos números.",
            *(script(nome) for nome in SCRIPTS_BASE),
            *(m.texto for m in todas),
            # Registradas como o `init-db` as registra: sem isso, o `load` pediria as migrações,
            # e um `init-db` depois tentaria aplicá-las de novo.
            *(_texto(registro(m)) for m in todas),
        ),
        "2_funcoes.sql": _arquivo(contrato, "Depois de 1_tabelas.sql.", script(SCRIPT_FUNCOES)),
        "3_views.sql": _arquivo(
            contrato,
            "Depois de 2_funcoes.sql.",
            *(_criar(v) for v in geradas),
            _texto(registro_das_geradas(geradas)),
            _texto(papel_sem_senha()),
            *(_texto(c) for c in concessoes(geradas)),
        ),
        "4_dados.sql": _arquivo(contrato, "Depois de 3_views.sql.", *(_texto(c) for c in dados)),
    }


def _versao_do_contrato(contrato: Contrato) -> sql.Composed:
    """A versão do contrato, já vigente, como o `init-db` a registra."""
    return sql.SQL(
        "INSERT INTO contrato_versao (impressao, versao, impressao_carga, conteudo, vigente) "
        "VALUES ({}, {}, {}, {}, true)"
    ).format(
        sql.Literal(contrato.impressao()),
        sql.Literal(contrato.schema_version),
        sql.Literal(contrato.impressao_da_carga()),
        sql.Literal(Jsonb(dict(contrato.bruto))),
    )


def _criar(view: View) -> str:
    """O CREATE da view, com o SQL sem o recuo do código, e o índice da chave das
    materializadas."""
    corpo = dedent(view.corpo.as_string(None)).strip()
    criar = f"CREATE {view.tipo_sql} {view.nome} AS\n{corpo}{view.sem_dados};"
    return "\n\n".join([criar, *(_texto(c) for c in view.indices())])


def _texto(comando: sql.Composable) -> str:
    """Um comando montado pelo código, como texto, com o `;`."""
    return f"{comando.as_string(None).strip()};"


def _arquivo(contrato: Contrato, uso: str, *partes: str) -> str:
    """O cabeçalho e as partes, na ordem, separadas por uma linha em branco."""
    cabecalho = (
        f"-- Gerado por `planaveg-core modelagem` do contrato {contrato.schema_version}: "
        f"não edite à mão. {uso}"
    )
    return "\n\n".join([cabecalho, *(p.strip() for p in partes)]) + "\n"
