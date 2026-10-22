"""O modelo do contrato: camadas, colunas, hierarquia (com os grupos), arranjos, filtros,
dimensões e fontes ausentes, como dataclasses imutáveis.
"""

from __future__ import annotations

import hashlib
import json
from collections.abc import Mapping
from dataclasses import dataclass
from typing import Any

from planaveg_core.errors import PlanavegError

PG = {"text": "text", "integer": "integer", "double": "double precision", "marca": "boolean"}


@dataclass(frozen=True)
class Atributo:
    """Uma coluna do arquivo que o modelo guarda em lugar próprio: o tipo que ela tem de ter e se
    pode vir vazia. As outras colunas do arquivo são marcas (`peca_marca`)."""

    tipo: str
    obrigatorio: bool
    aceita_fora: bool = False
    """O arquivo diz com um valor próprio (`fora`) que a peça cai fora dos limites oficiais: o
    banco guarda NULL, e as saídas publicadas devolvem o valor."""


ATRIBUTOS: Mapping[str, Atributo] = {
    "hierarquia": Atributo("text", obrigatorio=True),
    "tier": Atributo("integer", obrigatorio=True),
    "categoria": Atributo("text", obrigatorio=False),
    "computo_recebido_ha": Atributo("double", obrigatorio=True),
    "area_ha": Atributo("double", obrigatorio=True),
    "uf": Atributo("text", obrigatorio=True, aceita_fora=True),
    "bioma": Atributo("text", obrigatorio=True, aceita_fora=True),
    "municipio": Atributo("text", obrigatorio=False),
    "cod_municipio": Atributo("text", obrigatorio=True),
    "bacia": Atributo("text", obrigatorio=True),
    "bacia_meso": Atributo("text", obrigatorio=True),
    "regiao_hidrografica": Atributo("text", obrigatorio=True),
    "sobreposicao": Atributo("text", obrigatorio=False),
}
"""As colunas do arquivo que não são marcas, pelo `destino`, na ordem da tabela de pouso da carga.
O nível sai do rótulo (`hierarquia`), que tem de concordar com `tier` e `categoria`; o nome do
município é só conferido contra o IBGE; a região hidrográfica fica na mesobacia."""


@dataclass(frozen=True)
class Coluna:
    origem: str
    destino: str
    tipo: str
    anulavel: bool
    descricao: str
    marcado: str | None = None
    """Para `tipo = marca`: o único literal que liga a marca (vazio = desligada)."""
    fonte: str | None = None
    """`sobreposicao`: a marca vem da sigla dela na Sobreposicao, não da própria coluna, que só
    é conferida. None = da própria coluna."""
    fora: str | None = None
    """O valor que diz que a peça cai fora dos limites oficiais (`Atributo.aceita_fora`)."""

    @property
    def marca(self) -> bool:
        return self.tipo == "marca"


@dataclass(frozen=True)
class Camada:
    """Uma camada do GeoPackage: um ano de VS da série."""

    origem: str
    ano_vs: int
    rotulo: str


@dataclass(frozen=True)
class Nivel:
    """Uma linha da hierarquia: rótulo recebido em `hierarquia_planaveg` → código do nível.

    Os níveis 9–11 têm um rótulo por condição do CAR; o código é o mesmo. `rotulo` None
    é um nível que o arquivo não materializa (`ausente` diz por quê).
    """

    tier: int
    codigo: str
    grupo: str
    rotulo: str | None
    titulo: str
    categoria: str | None
    ausente: str | None
    cor: str
    situacao: str | None = None
    """A situação do cadastro no CAR com o nome da planilha de nomenclatura, que junta as
    condições da base (`categoria`): a que as saídas publicadas mostram. Só nos níveis 9–11."""


@dataclass(frozen=True)
class Arranjo:
    codigo: str
    titulo: str
    criterio: str
    predicado: Mapping[str, Any] | None
    """None = complementar: recebe o que nenhum arranjo anterior reivindicou. Um arranjo
    `ausente` também não tem predicado, mas não recebe nada."""
    cor: str
    meta_ha: float | None = None
    """Meta de recuperação do arranjo (Figura 4 do relatório técnico), em hectares."""
    meta_ano: int | None = None
    ausente: str | None = None
    """Por que o arranjo fica com 0 ha: a base não traz o que a regra dele pede."""

    @property
    def complementar(self) -> bool:
        return self.predicado is None and self.ausente is None


@dataclass(frozen=True)
class Filtro:
    codigo: str
    grupo: str
    titulo: str
    subtitulo: str | None
    tipo: str
    predicado: Mapping[str, Any]
    status: str
    nota: str | None
    cor: str

    @property
    def espacial(self) -> bool:
        return self.tipo in {"espacial", "ambos"}

    @property
    def tema(self) -> bool:
        """O portal o oferece como tema: é espacial e não repete um arranjo (um filtro que só
        lista arranjos já é uma opção da lista de caminhos)."""
        return self.espacial and set(self.predicado) != {"arranjo"}


@dataclass(frozen=True)
class Dimensao:
    """Um recorte de lugar dos quantitativos. A chave e o rótulo de cada valor estão no SQL, em
    `peca_lugar`."""

    codigo: str
    grupo: str
    titulo: str


@dataclass(frozen=True)
class Grupo:
    """Um grupo de níveis da hierarquia (`projetos`, `vs_protegida`, `car`), com o título."""

    codigo: str
    titulo: str


@dataclass(frozen=True)
class FonteAusente:
    """O que o relatório pede e a base não traz."""

    codigo: str
    grupo: str
    descricao: str


@dataclass(frozen=True)
class Contrato:
    schema_version: str
    application_id: int
    user_versions: tuple[int, ...]
    sha256: str | None
    srid: int
    tipo_srs: str
    proj4: str
    coluna_geom: str
    coluna_pk: str
    camadas: tuple[Camada, ...]
    colunas: tuple[Coluna, ...]
    sobreposicao: tuple[tuple[str, str], ...]
    """(marca, sigla) na ordem em que a coluna Sobreposicao as concatena."""
    hierarquia: tuple[Nivel, ...]
    arranjos: tuple[Arranjo, ...]
    filtros: tuple[Filtro, ...]
    dimensoes: tuple[Dimensao, ...]
    bruto: Mapping[str, Any]
    arquivo_referencia: str
    """O nome do GeoPackage que o contrato descreve: o padrão quando `GPKG_PATH` não é dado."""
    geometria: str
    """O tipo de geometria que as camadas declaram no GeoPackage."""
    grupos: tuple[Grupo, ...]
    fontes_ausentes: tuple[FonteAusente, ...]

    def camada(self, origem: str) -> Camada:
        for camada in self.camadas:
            if camada.origem == origem:
                return camada
        raise PlanavegError("camada_fora_do_contrato", origem)

    def marcas(self) -> tuple[str, ...]:
        return tuple(c.destino for c in self.colunas if c.marca)

    def niveis_presentes(self) -> tuple[Nivel, ...]:
        return tuple(n for n in self.hierarquia if n.rotulo is not None)

    def impressao(self) -> str:
        """SHA-256 do contrato inteiro, em JSON canônico: a identidade da versão dele
        (`contrato_versao`). O `schema_version` é só o rótulo."""
        return _sha256_canonico(self.bruto)

    def impressao_da_carga(self) -> str:
        """SHA-256 do que a carga lê do contrato (o arquivo, as camadas, as colunas e as siglas
        da Sobreposicao, de onde sai a marca uc): o que, se mudar, pede uma carga nova. Os textos
        (o `rotulo` das camadas, a `descricao` das colunas), a hierarquia, os filtros e as cores
        só pedem `init-db` e `geoserver`."""
        return _sha256_canonico(
            {
                "recipiente": self.bruto["recipiente"],
                "camadas": [
                    {k: v for k, v in c.items() if k != "rotulo"} for c in self.bruto["camadas"]
                ],
                "colunas": [
                    {k: v for k, v in c.items() if k != "descricao"} for c in self.bruto["colunas"]
                ],
                "sobreposicao": self.bruto["sobreposicao"],
            }
        )


def _sha256_canonico(dado: object) -> str:
    texto = json.dumps(dado, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(texto.encode("utf-8")).hexdigest()
