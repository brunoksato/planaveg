"""Um GeoPackage pequeno, gerado do contrato, para testar a leitura e a carga sem o arquivo real.

Cada peça é um quadrado no Albers do contrato (metros), com os atributos de um nível presente da
hierarquia; as marcas vêm desligadas. Dois quadrados que se cruzam são uma sobreposição.
"""

from __future__ import annotations

import sqlite3
import struct
from collections.abc import Mapping, Sequence
from contextlib import closing
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from planaveg_core.contrato import Contrato

_TIPO_SQLITE = {"text": "TEXT", "integer": "INTEGER", "double": "REAL", "marca": "TEXT"}

WKT1_ALBERS = (
    'PROJCS["Albers IBGE",GEOGCS["SIRGAS 2000",DATUM["SIRGAS_2000",'
    'SPHEROID["GRS 1980",6378137,298.257222101]],PRIMEM["Greenwich",0],'
    'UNIT["degree",0.0174532925199433]],PROJECTION["Albers_Conic_Equal_Area"],'
    'PARAMETER["latitude_of_center",-12],PARAMETER["longitude_of_center",-54],'
    'PARAMETER["standard_parallel_1",-2],PARAMETER["standard_parallel_2",-22],'
    'PARAMETER["false_easting",0],PARAMETER["false_northing",0],UNIT["metre",1]]'
)
"""O Albers do contrato em WKT1, como o arquivo real o traz."""

WKT2_ALBERS = (
    'PROJCRS["Albers IBGE",BASEGEOGCRS["SIRGAS 2000",DATUM["SIRGAS 2000",'
    'ELLIPSOID["GRS 1980",6378137,298.257222101,LENGTHUNIT["metre",1]]]],'
    'CONVERSION["Albers",METHOD["Albers Equal Area",ID["EPSG",9822]],'
    'PARAMETER["Latitude of false origin",-12,ANGLEUNIT["degree",0.0174532925199433]],'
    'PARAMETER["Longitude of false origin",-54,ANGLEUNIT["degree",0.0174532925199433]],'
    'PARAMETER["Latitude of 1st standard parallel",-2,ANGLEUNIT["degree",0.0174532925199433]],'
    'PARAMETER["Latitude of 2nd standard parallel",-22,ANGLEUNIT["degree",0.0174532925199433]],'
    'PARAMETER["Easting at false origin",0,LENGTHUNIT["metre",1]],'
    'PARAMETER["Northing at false origin",0,LENGTHUNIT["metre",1]]],'
    'CS[Cartesian,2],AXIS["easting",east],AXIS["northing",north],LENGTHUNIT["metre",1]]'
)
"""O mesmo Albers em WKT2 (GeoPackage 1.2+ com a extensão crs_wkt)."""


@dataclass(frozen=True)
class Quadrado:
    fid: int
    x: float
    y: float
    lado: float
    """Em metros, no Albers: a área é lado² / 10.000 hectares."""
    atributos: Mapping[str, Any] = field(default_factory=dict)
    """Valores que trocam os padrões, pelo nome da coluna no banco (`destino`)."""


def geometria(quadrado: Quadrado, srs_id: int) -> bytes:
    """GeoPackageBinary (cabeçalho sem envelope, little endian) com o WKB do multipolígono."""
    x, y, lado = quadrado.x, quadrado.y, quadrado.lado
    pontos = [(x, y), (x + lado, y), (x + lado, y + lado), (x, y + lado), (x, y)]
    wkb = (
        struct.pack("<BII", 1, 6, 1)
        + struct.pack("<BII", 1, 3, 1)
        + struct.pack("<I", len(pontos))
        + b"".join(struct.pack("<dd", px, py) for px, py in pontos)
    )
    return b"GP" + bytes([0, 0b00000001]) + struct.pack("<i", srs_id) + wkb


def _valores(contrato: Contrato, quadrado: Quadrado) -> list[object]:
    """Os atributos de uma peça do primeiro nível presente, na ordem das colunas do contrato."""
    nivel = contrato.niveis_presentes()[0]
    area = quadrado.lado**2 / 10_000
    fixos: Mapping[str, object] = {
        "hierarquia": nivel.rotulo,
        "tier": nivel.tier,
        "categoria": nivel.categoria,
        "computo_recebido_ha": area,
        "area_ha": area,
        "uf": "GO",
        "bioma": "Cerrado",
        "municipio": "Quirinópolis",
        "cod_municipio": "5218508",
        "sobreposicao": None,
        **quadrado.atributos,
    }
    valores: list[object] = []
    for coluna in contrato.colunas:
        if coluna.marca:
            valores.append("")
        elif coluna.destino in fixos:
            valores.append(fixos[coluna.destino])
        elif coluna.tipo == "text":
            valores.append(f"{coluna.destino} teste")
        else:
            valores.append(1)
    return valores


def gerar(
    caminho: Path,
    contrato: Contrato,
    pecas: Mapping[str, Sequence[Quadrado]],
    *,
    wkt: str = WKT1_ALBERS,
) -> Path:
    """Grava em `caminho` um GeoPackage com uma tabela por camada do contrato e as peças dadas
    (pela origem da camada; uma camada sem peças fica vazia)."""
    srid = contrato.srid
    colunas = [(c.origem, _TIPO_SQLITE[c.tipo]) for c in contrato.colunas]
    with closing(sqlite3.connect(caminho)) as con:
        con.execute(f"PRAGMA application_id = {int(contrato.application_id)}")
        con.execute(f"PRAGMA user_version = {int(contrato.user_versions[0])}")
        con.execute(
            "CREATE TABLE gpkg_spatial_ref_sys (srs_name TEXT, srs_id INTEGER PRIMARY KEY, "
            "organization TEXT, organization_coordsys_id INTEGER, definition TEXT, "
            "description TEXT)"
        )
        con.execute(
            "INSERT INTO gpkg_spatial_ref_sys VALUES ('Albers IBGE', ?, 'NONE', ?, ?, NULL)",
            (srid, srid, wkt),
        )
        con.execute(
            "CREATE TABLE gpkg_contents (table_name TEXT PRIMARY KEY, data_type TEXT, "
            "identifier TEXT, srs_id INTEGER)"
        )
        con.execute(
            "CREATE TABLE gpkg_geometry_columns (table_name TEXT, column_name TEXT, "
            "geometry_type_name TEXT, srs_id INTEGER, z INTEGER, m INTEGER)"
        )
        for camada in contrato.camadas:
            nome = camada.origem
            definicao = ", ".join(f'"{o}" {t}' for o, t in colunas)
            con.execute(
                f'CREATE TABLE "{nome}" ("{contrato.coluna_pk}" INTEGER PRIMARY KEY, '
                f'{definicao}, "{contrato.coluna_geom}" BLOB)'
            )
            con.execute(
                "INSERT INTO gpkg_contents VALUES (?, 'features', ?, ?)", (nome, nome, srid)
            )
            con.execute(
                "INSERT INTO gpkg_geometry_columns VALUES (?, ?, ?, ?, 0, 0)",
                (nome, contrato.coluna_geom, contrato.geometria, srid),
            )
            marcadores = ", ".join("?" for _ in range(len(colunas) + 2))
            for quadrado in pecas.get(nome, ()):
                con.execute(
                    f'INSERT INTO "{nome}" VALUES ({marcadores})',  # noqa: S608
                    (quadrado.fid, *_valores(contrato, quadrado), geometria(quadrado, srid)),
                )
        con.commit()
    return caminho
