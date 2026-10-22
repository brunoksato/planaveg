"""A modelagem em SQL puro (`modelagem/`, na raiz do repositório): em dia com o código e o
contrato, um arquivo por assunto, sem senha."""

from __future__ import annotations

from pathlib import Path

from planaveg_core import banco
from planaveg_core.contrato import Contrato

PASTA = Path(__file__).resolve().parents[3] / "modelagem"
ARQUIVOS = ["1_tabelas.sql", "2_funcoes.sql", "3_views.sql", "4_dados.sql"]
# Escritos à mão, fora do `modelagem`: o tutorial (exportado do documento), como usar a pasta e
# as consultas do portal, para leitura.
A_MAO = ["EXPLAIN.MD", "README.md", "consultas.sql"]


def test_modelagem_em_dia_com_o_codigo(contrato: Contrato) -> None:
    arquivos = banco.modelagem(contrato)
    assert sorted(p.name for p in PASTA.iterdir()) == [*ARQUIVOS, *A_MAO]
    for nome, texto in arquivos.items():
        gravado = (PASTA / nome).read_text(encoding="utf-8")
        assert gravado == texto, f"{nome} ficou para trás: rode `make modelagem` em apps/core"


def test_cabecalho_e_sem_senha(contrato: Contrato) -> None:
    for nome, texto in banco.modelagem(contrato).items():
        assert texto.startswith("-- Gerado por `planaveg-core modelagem`"), nome
        # A senha do papel de leitura nunca vai no arquivo: o init-db a grava das configurações.
        assert "PASSWORD" not in texto and "SCRAM" not in texto, nome
