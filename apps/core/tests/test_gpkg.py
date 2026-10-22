from __future__ import annotations

import struct
from pathlib import Path

import gpkg_sintetico
import pytest

from planaveg_core import gpkg
from planaveg_core.contrato import Contrato
from planaveg_core.errors import PlanavegError
from planaveg_core.gpkg import ler_geometria

_PONTO = bytes.fromhex("010100000000000000000000000000000000000000")


def _gp(
    wkb: bytes, *, empty: bool = False, envelope: int = 0, srs: int = 4674, extended: bool = False
) -> bytes:
    flags = 0b1  # little endian
    flags |= envelope << 1
    if empty:
        flags |= 0b10000
    if extended:
        flags |= 0b100000
    header = b"GP" + bytes([0, flags]) + struct.pack("<i", srs)
    if envelope == 1:
        header += struct.pack("<4d", 0, 0, 1, 1)
    return header + wkb


def test_extrai_wkb_sem_envelope() -> None:
    assert ler_geometria(_gp(_PONTO)).wkb == _PONTO


def test_extrai_wkb_com_envelope_xy() -> None:
    assert ler_geometria(_gp(_PONTO, envelope=1)).wkb == _PONTO


def test_geometria_vazia_vira_bytes_vazios() -> None:
    geometria = ler_geometria(_gp(b"\x00", empty=True, srs=4326))
    assert geometria.wkb == b""
    assert geometria.srs_id == 4326


def _arquivo(tmp_path: Path, contrato: Contrato, nome: str = "base.gpkg", **kw: str) -> Path:
    pecas = {c.origem: [gpkg_sintetico.Quadrado(1, 0.0, 0.0, 100.0)] for c in contrato.camadas}
    return gpkg_sintetico.gerar(tmp_path / nome, contrato, pecas, **kw)


def test_inspeciona_um_arquivo_conforme_o_contrato(tmp_path: Path, contrato: Contrato) -> None:
    recipiente = gpkg.inspecionar(_arquivo(tmp_path, contrato), contrato)
    assert recipiente.application_id == contrato.application_id
    assert sorted(c.nome for c in recipiente.camadas) == sorted(c.origem for c in contrato.camadas)
    assert all(c.n_registros == 1 for c in recipiente.camadas)


def test_aceita_o_srs_em_wkt2(tmp_path: Path, contrato: Contrato) -> None:
    arquivo = _arquivo(tmp_path, contrato, wkt=gpkg_sintetico.WKT2_ALBERS)
    assert len(gpkg.inspecionar(arquivo, contrato).camadas) == len(contrato.camadas)


def test_parametro_do_albers_diferente_do_contrato_reprova(
    tmp_path: Path, contrato: Contrato
) -> None:
    wkt = gpkg_sintetico.WKT1_ALBERS.replace(
        '"standard_parallel_2",-22', '"standard_parallel_2",-20'
    )
    with pytest.raises(PlanavegError) as info:
        gpkg.inspecionar(_arquivo(tmp_path, contrato, wkt=wkt), contrato)
    assert info.value.codigo == "gpkg_srs_parametros_divergentes"
    assert "standard_parallel_2" in str(info.value)
