"""planaveg_core: recebe o GeoPackage Planaveg, modela no PostGIS e publica no GeoServer."""

from __future__ import annotations

from importlib.metadata import PackageNotFoundError, version

try:
    __version__ = version("planaveg-core")
except PackageNotFoundError:  # pragma: no cover - só fora de um ambiente instalado
    __version__ = "0.0.0"
