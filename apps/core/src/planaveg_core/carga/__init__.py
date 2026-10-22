"""Carga do GeoPackage (`load`): SQLite → COPY em tabela temporária → `peca_recebida`.

Idempotente por conteúdo: o mesmo arquivo (SHA-256 + versão do contrato) reutiliza a
mesma `entrega`; um arquivo diferente cria outra entrega e marca a pronta como `substituida`.
`peca_recebida` guarda sempre uma única entrega, com uma camada por ano de VS. A carga é uma
transação só: quem lê vê a base anterior até o fim, e uma falha a deixa como estava.

Módulos: `conversores` (os valores), `entrega` (o arquivo recebido) e `pecas` (a carga).
"""

from planaveg_core.carga.conversores import ValorInvalido, conversor_para
from planaveg_core.carga.entrega import sha256_arquivo
from planaveg_core.carga.pecas import carregar

__all__ = ["ValorInvalido", "carregar", "conversor_para", "sha256_arquivo"]
