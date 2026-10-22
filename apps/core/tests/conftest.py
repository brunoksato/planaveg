from __future__ import annotations

from pathlib import Path

import pytest
from geoserver_falso import GeoServerFalso

from planaveg_core.config import Settings
from planaveg_core.contrato import Contrato, carregar_contrato

CAMINHO_CONTRATO = (
    Path(__file__).resolve().parents[1]
    / "src"
    / "planaveg_core"
    / "contracts"
    / "categorias.v1.json"
)


@pytest.fixture(scope="session")
def caminho_contrato() -> Path:
    return CAMINHO_CONTRATO


@pytest.fixture(scope="session")
def contrato() -> Contrato:
    return carregar_contrato(CAMINHO_CONTRATO)


@pytest.fixture
def geoserver(monkeypatch: pytest.MonkeyPatch) -> GeoServerFalso:
    """Um GeoServer falso no lugar da rede (`geoserver_falso.py`)."""
    falso = GeoServerFalso()
    monkeypatch.setattr("planaveg_core.rest.urlopen", falso.urlopen)
    return falso


@pytest.fixture
def settings_locais(monkeypatch: pytest.MonkeyPatch) -> Settings:
    """As configurações com os padrões do ambiente local, sem as variáveis de quem roda o teste."""
    for nome in ("GEOSERVER_URL", "GEOSERVER_USER", "GEOSERVER_PASSWORD", "GWC_COTA_GB"):
        monkeypatch.delenv(nome, raising=False)
    return Settings.from_env()
