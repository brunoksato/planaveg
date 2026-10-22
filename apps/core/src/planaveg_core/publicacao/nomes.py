"""O `View`, a view gerada do contrato, e os nomes das camadas que se repetem por ano e por
filtro."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

from psycopg import sql

from planaveg_core.contrato import Contrato, Filtro

Familia = Literal["pecas", "filtros"]
"""A família de uma camada em cache: as peças de um ano ou os filtros espaciais."""


@dataclass(frozen=True)
class View:
    nome: str
    corpo: sql.Composable
    descricao: str
    """`Título | descrição`: o título e o resumo da camada no GeoServer."""
    materializada: bool = False
    publicada: bool = False
    espacial: bool = False
    estilos: tuple[str, ...] = ()
    """Estilos GeoServer da camada; o primeiro é o padrão."""
    tiles: bool = False
    """O portal a desenha do cache de tiles (GeoWebCache), e não por WMS direto."""
    familia: Familia = "filtros"
    """Das camadas em cache: as peças de um ano aceitam os filtros do portal (CQL) no cache, e
    cada família tem a sua profundidade de semeadura."""
    parametros: tuple[str, ...] = ()
    """Colunas que o GeoServer exige na URL (`viewparams`), cada uma igual a um número: a view
    vai publicada como consulta (SQL view do GeoServer) que, sem elas, não devolve nada, em vez
    de ser varrida inteira. A chave dela (`fid`) vai nessa definição, não em gt_pk_metadata."""
    estilos_do_portal: tuple[str, ...] = ()
    """Das camadas em cache: os estilos que o mapa do portal pede, os únicos que a semeadura
    leva além da vista nacional (os outros, para o QGIS, entram no cache quando pedidos).
    Vazio = todos."""
    chave: tuple[str, ...] = ()
    """Das materializadas: as colunas que identificam uma linha. Viram um índice único (com
    NULL igual a NULL), que deixa recalcular sem bloquear quem lê (`CONCURRENTLY`)."""

    @property
    def alvo(self) -> sql.Identifier:
        return sql.Identifier(self.nome)

    @property
    def tipo(self) -> str:
        return "matview" if self.materializada else "view"

    @property
    def filtravel(self) -> bool:
        """Aceita os filtros do portal (`CQL_FILTER`) na chave do cache: as peças de um ano. As
        camadas dos filtros espaciais já são filtros."""
        return self.familia == "pecas"

    @property
    def camada_de_mapa(self) -> bool:
        """Publicada, com geometria e varrível: tem `fid` em `gt_pk_metadata`, linha em
        `camada_publicada` e as conferências de camada. A consulta com parâmetros (`peca_parte`)
        fica de fora: a chave dela vai na definição do GeoServer, e contá-la inteira desmontaria
        todas as peças."""
        return self.publicada and self.espacial and not self.parametros

    @property
    def titulo(self) -> str:
        return self.descricao.partition(" | ")[0]

    @property
    def resumo(self) -> str:
        return self.descricao.partition(" | ")[2]

    @property
    def tipo_sql(self) -> str:
        return "MATERIALIZED VIEW" if self.materializada else "VIEW"

    @property
    def sem_dados(self) -> str:
        """A materializada nasce vazia: quem cria preenche todas depois dos dados de referência,
        na ordem (`preencher`)."""
        return "\nWITH NO DATA" if self.materializada else ""

    def indices(self) -> list[sql.Composed]:
        """Nas materializadas com chave, o índice único dela."""
        if not self.chave:
            return []
        return [
            sql.SQL("CREATE UNIQUE INDEX {} ON {} ({}) NULLS NOT DISTINCT").format(
                sql.Identifier(f"{self.nome}_chave"),
                self.alvo,
                sql.SQL(", ").join(sql.Identifier(c) for c in self.chave),
            )
        ]

    def criar(self) -> list[sql.Composed]:
        """CREATE e, nas materializadas, o índice da chave. Quem chama derruba a anterior
        (`_descartar_geradas`, no `banco`)."""
        criar = sql.SQL("CREATE {} {} AS{}{}").format(
            sql.SQL(self.tipo_sql), self.alvo, self.corpo, sql.SQL(self.sem_dados)
        )
        return [criar, *self.indices()]

    def preencher(self) -> sql.Composed:
        """Calcula a materializada pela primeira vez, logo depois de criada."""
        return sql.SQL("REFRESH MATERIALIZED VIEW {}").format(self.alvo)

    def atualizar(self) -> sql.Composed:
        """Recalcula a materializada. Com a chave, `CONCURRENTLY`: quem lê continua vendo o
        conteúdo anterior até o fim da transação, em vez de esperar."""
        if self.chave:
            return sql.SQL("REFRESH MATERIALIZED VIEW CONCURRENTLY {}").format(self.alvo)
        return sql.SQL("REFRESH MATERIALIZED VIEW {}").format(self.alvo)


def nome_peca_ano(ano: int) -> str:
    return f"peca_{ano}"


def nome_peca_recente(contrato: Contrato) -> str:
    """A camada das peças do ano mais recente: a única que o portal desenha."""
    return nome_peca_ano(max(c.ano_vs for c in contrato.camadas))


def nome_espacial(filtro: Filtro, ano: int) -> str:
    return f"espacial_{filtro.codigo}_{ano}"
