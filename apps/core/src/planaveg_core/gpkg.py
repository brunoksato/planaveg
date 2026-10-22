"""O recipiente GeoPackage (SQLite): conferência contra o contrato e leitura da geometria."""

from __future__ import annotations

import re
import sqlite3
import struct
from contextlib import closing
from dataclasses import dataclass
from pathlib import Path

from planaveg_core.contrato import Contrato
from planaveg_core.errors import PlanavegError

# Tipo declarado no SQLite para cada tipo do contrato.
_TIPO_SQLITE = {"text": "TEXT", "integer": "INTEGER", "double": "REAL", "marca": "TEXT"}

# GeoPackageBinary: 'GP' + version + flags + srs_id + envelope opcional + WKB.
# flags: bit 0 = ordem de bytes (1 = little endian), bits 1-3 = envelope
# (0 = nenhum, 1 = XY, 2 = XYZ, 3 = XYM, 4 = XYZM), bit 4 = geometria vazia,
# bit 5 = binário estendido (não suportado).
_ENVELOPE_BYTES = {0: 0, 1: 32, 2: 48, 3: 48, 4: 64}
_FLAG_VAZIA = 0b00010000
_FLAG_ESTENDIDO = 0b00100000
_CABECALHO_MINIMO = 8  # magic (2) + version (1) + flags (1) + srs_id (4)

_TAMANHO_MAXIMO_IDENT = 128


@dataclass(frozen=True)
class CamadaObservada:
    """Uma camada do arquivo, já conferida: o SRID, o SRS e a coluna da geometria são os do
    contrato."""

    nome: str
    n_registros: int


@dataclass(frozen=True)
class Recipiente:
    caminho: Path
    application_id: int
    user_version: int
    camadas: tuple[CamadaObservada, ...]


@dataclass(frozen=True)
class GeometriaGpkg:
    srs_id: int
    wkb: bytes  # vazio quando a geometria é vazia


def sqlite_ident(valor: str) -> str:
    """Identificador SQLite citado. Só aceita nomes alfanuméricos do contrato."""
    if (
        not valor
        or len(valor) > _TAMANHO_MAXIMO_IDENT
        or any(not (ch.isalnum() or ch == "_") for ch in valor)
    ):
        raise PlanavegError("identificador_origem_invalido", valor)
    return '"' + valor.replace('"', '""') + '"'


def abrir(caminho: Path) -> sqlite3.Connection:
    """Conexão só de leitura ao GeoPackage. Quem abre fecha (`contextlib.closing`).

    O caminho vai escapado na URI (`as_uri`): um `?` ou um `#` no nome do arquivo não vira
    parâmetro da conexão.
    """
    con = sqlite3.connect(f"{caminho.resolve().as_uri()}?mode=ro", uri=True)
    con.execute("PRAGMA query_only=ON")
    return con


def ler_geometria(blob: bytes) -> GeometriaGpkg:
    """Interpreta o cabeçalho GeoPackage e devolve srs_id + WKB puro para o PostGIS."""
    if len(blob) < _CABECALHO_MINIMO or blob[:2] != b"GP":
        raise PlanavegError("geometria_geopackage_invalida")

    flags = blob[3]
    if flags & _FLAG_ESTENDIDO:
        raise PlanavegError("geometria_geopackage_estendida")

    envelope = (flags >> 1) & 0x07
    tamanho = _ENVELOPE_BYTES.get(envelope)
    if tamanho is None:
        raise PlanavegError("geometria_geopackage_invalida")

    little = bool(flags & 0b1)
    srs_id = int(struct.unpack_from("<i" if little else ">i", blob, 4)[0])
    if flags & _FLAG_VAZIA:
        return GeometriaGpkg(srs_id=srs_id, wkb=b"")

    inicio = _CABECALHO_MINIMO + tamanho
    if len(blob) <= inicio:
        raise PlanavegError("geometria_geopackage_invalida")

    return GeometriaGpkg(srs_id=srs_id, wkb=blob[inicio:])


def _tipo_srs(definicao: str) -> str:
    cabeca = definicao.strip().upper()[:12]
    if cabeca.startswith(("GEOGCS", "GEOGCRS", "GEODCRS")):
        return "geografico"
    if cabeca.startswith(("PROJCS", "PROJCRS")):
        return "projetado"
    return "desconhecido"


# Os parâmetros do Albers no proj4 do contrato e os nomes deles no WKT1 e no WKT2 do arquivo.
_ALBERS = {
    "lat_0": ("latitude_of_center", "latitude of false origin"),
    "lon_0": ("longitude_of_center", "longitude of false origin"),
    "lat_1": ("standard_parallel_1", "latitude of 1st standard parallel"),
    "lat_2": ("standard_parallel_2", "latitude of 2nd standard parallel"),
    "x_0": ("false_easting", "easting at false origin"),
    "y_0": ("false_northing", "northing at false origin"),
}


def _parametros_wkt(definicao: str) -> dict[str, float]:
    """Parâmetros numéricos do WKT1 (`PARAMETER["nome",valor]`) e do WKT2
    (`PARAMETER["nome",valor,ANGLEUNIT[...]]`), com o nome em minúsculas."""
    return {
        nome.lower(): float(valor)
        for nome, valor in re.findall(
            r'PARAMETER\["([^"]+)",\s*(-?\d+(?:\.\d*)?(?:[eE][-+]?\d+)?)', definicao
        )
    }


def _albers_do_contrato(contrato: Contrato) -> dict[str, float]:
    """Os parâmetros do Albers no `proj4` do contrato: os do `init-db` e os do arquivo."""
    termos = dict(
        termo.removeprefix("+").split("=", 1) for termo in contrato.proj4.split() if "=" in termo
    )
    if termos.get("proj") != "aea" or not set(_ALBERS) <= set(termos):
        raise PlanavegError("contrato_srs_nao_albers", contrato.proj4)
    try:
        return {parametro: float(termos[parametro]) for parametro in _ALBERS}
    except ValueError:
        raise PlanavegError("contrato_srs_nao_albers", contrato.proj4) from None


def _conferir_srs(definicao: str, contrato: Contrato) -> None:
    """O SRS da camada tem de ser o Albers que o `init-db` registra com o proj4 do contrato.

    Número SRS local não é código EPSG: confere-se o tipo e os parâmetros, não o número. Os
    parâmetros esperados vêm do proj4 do contrato; o arquivo pode trazer o WKT1 ou o WKT2.
    """
    tipo = _tipo_srs(definicao)
    if tipo != contrato.tipo_srs or "ALBERS" not in definicao.upper():
        raise PlanavegError("gpkg_srs_inesperado", f"srs_id={contrato.srid} {tipo}")
    parametros = _parametros_wkt(definicao)
    divergentes: list[str] = []
    for parametro, valor in _albers_do_contrato(contrato).items():
        wkt1, wkt2 = _ALBERS[parametro]
        if parametros.get(wkt1, parametros.get(wkt2)) != valor:
            divergentes.append(wkt1)
    divergentes.sort()
    if divergentes:
        raise PlanavegError("gpkg_srs_parametros_divergentes", ", ".join(divergentes))


def inspecionar(caminho: Path, contrato: Contrato) -> Recipiente:
    """Confere o recipiente contra o contrato: formato, camadas, CRS e colunas de cada uma."""
    if not caminho.is_file():
        raise PlanavegError("gpkg_nao_encontrado", str(caminho))
    try:
        with closing(abrir(caminho)) as con:
            return _inspecionar(con, caminho, contrato)
    except sqlite3.DatabaseError as exc:
        # Um arquivo que não é SQLite falha na primeira leitura.
        raise PlanavegError("gpkg_invalido", caminho.name) from exc


def _inspecionar(con: sqlite3.Connection, caminho: Path, contrato: Contrato) -> Recipiente:
    application_id = int(con.execute("PRAGMA application_id").fetchone()[0])
    user_version = int(con.execute("PRAGMA user_version").fetchone()[0])

    if application_id != contrato.application_id:
        raise PlanavegError("gpkg_application_id_divergente")
    if user_version not in contrato.user_versions:
        raise PlanavegError("gpkg_user_version_divergente")

    definicoes = {
        int(srs): str(definicao)
        for srs, definicao in con.execute(
            "SELECT srs_id, definition FROM gpkg_spatial_ref_sys"
        ).fetchall()
    }

    linhas = con.execute(
        """
        SELECT c.table_name, c.srs_id, g.column_name, g.geometry_type_name
        FROM gpkg_contents c
        JOIN gpkg_geometry_columns g ON g.table_name = c.table_name
        WHERE c.data_type = 'features'
        ORDER BY c.table_name
        """
    ).fetchall()

    nomes = {str(linha[0]) for linha in linhas}
    esperados = {camada.origem for camada in contrato.camadas}
    if nomes != esperados:
        raise PlanavegError(
            "gpkg_camadas_divergentes",
            f"ausentes={sorted(esperados - nomes)} extras={sorted(nomes - esperados)}",
        )

    colunas_esperadas = {
        contrato.coluna_pk: "INTEGER",
        **{c.origem: _TIPO_SQLITE[c.tipo] for c in contrato.colunas},
    }
    observadas: list[CamadaObservada] = []
    for nome, srid_bruto, coluna, tipo_geom in linhas:
        srid = int(srid_bruto)
        if srid != contrato.srid:
            raise PlanavegError("gpkg_srid_divergente_do_contrato", f"{nome}: {srid}")
        if str(coluna) != contrato.coluna_geom or str(tipo_geom).upper() != contrato.geometria:
            raise PlanavegError("gpkg_geometria_inesperada", f"{nome}: {coluna} {tipo_geom}")
        _conferir_srs(definicoes.get(srid, ""), contrato)

        tabela = sqlite_ident(str(nome))
        # Uma linha por coluna da tabela: (cid, name, type, notnull, dflt_value, pk).
        colunas_da_tabela = con.execute(f"PRAGMA table_info({tabela})").fetchall()
        declaradas = {
            str(nome_da_coluna): str(tipo).upper()
            for _cid, nome_da_coluna, tipo, *_ in colunas_da_tabela
            if str(nome_da_coluna) != contrato.coluna_geom
        }
        if declaradas != colunas_esperadas:
            faltam = sorted(set(colunas_esperadas) - set(declaradas))
            sobram = sorted(set(declaradas) - set(colunas_esperadas))
            tipos = sorted(
                k
                for k in set(declaradas) & set(colunas_esperadas)
                if declaradas[k] != colunas_esperadas[k]
            )
            raise PlanavegError(
                "gpkg_colunas_divergentes",
                f"{nome}: ausentes={faltam} extras={sobram} tipos={tipos}",
            )

        contagem = f"SELECT count(*) FROM {tabela}"  # noqa: S608  # nosec B608
        n = int(con.execute(contagem).fetchone()[0])
        observadas.append(CamadaObservada(str(nome), n))

    return Recipiente(
        caminho=caminho,
        application_id=application_id,
        user_version=user_version,
        camadas=tuple(observadas),
    )
