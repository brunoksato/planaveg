"""Configuração por variáveis de ambiente. Os defaults apontam para o banco do `compose.yaml` da
raiz."""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

from planaveg_core.errors import PlanavegError


def _repo_root() -> Path:
    """Raiz do projeto (`apps/core`, onde fica o `pyproject.toml`)."""
    for pasta in Path(__file__).resolve().parents:
        if (pasta / "pyproject.toml").is_file() and (pasta / "src" / "planaveg_core").is_dir():
            return pasta
    return Path.cwd()


def _pasta_gpkg(repo: Path) -> Path:
    """`docs/gpkg/` do monorepo, onde o GeoPackage fica fora do Git; senão `gpkg/` do projeto."""
    for pasta in (repo, *repo.parents):
        if (pasta / "docs" / "gpkg").is_dir():
            return pasta / "docs" / "gpkg"
    return repo / "gpkg"


def _texto(nome: str, padrao: str) -> str:
    return os.environ.get(nome, "").strip() or padrao


def _caminho(nome: str) -> Path | None:
    valor = os.environ.get(nome, "").strip()
    return Path(valor).expanduser().resolve() if valor else None


def _inteiro(nome: str, *, minimo: int | None = None) -> int | None:
    bruto = os.environ.get(nome, "").strip()
    if not bruto:
        return None
    try:
        valor = int(bruto)
    except ValueError as exc:
        raise PlanavegError(f"{nome.lower()}_invalido", bruto) from exc
    if minimo is not None and valor < minimo:
        raise PlanavegError(f"{nome.lower()}_invalido", f"{bruto} (o mínimo é {minimo})")
    return valor


@dataclass(frozen=True)
class Settings:
    database_url: str
    gpkg_path: Path | None
    """`GPKG_PATH`. Sem ele, o arquivo que o contrato descreve, em `gpkg_dir` (`arquivo_gpkg`)."""
    gpkg_dir: Path
    """`GPKG_DIR`, ou `docs/gpkg/` do monorepo (ou `gpkg/` do projeto)."""
    contract_path: Path
    geoserver_url: str
    geoserver_user: str
    geoserver_password: str
    geoserver_pg_host: str
    geoserver_pg_port: int
    geoserver_pg_database: str
    geoserver_pg_password: str
    gwc_cota_gb: int | None = None
    """Teto do cache de tiles em GiB, com descarte dos menos usados; sem valor, sem teto."""
    vigentes: Path | None = None
    """`VERSOES_VIGENTES`: onde o registro das etapas deixa um arquivo por versão vigente, para o
    nginx (`banco/vigentes.py`). Sem valor (o ambiente local), nada é escrito."""

    def arquivo_gpkg(self, nome: str) -> Path:
        """O GeoPackage: `GPKG_PATH`, ou o arquivo `nome` (o do contrato) na pasta padrão."""
        return self.gpkg_path or self.gpkg_dir / nome

    @classmethod
    def from_env(cls) -> Settings:
        repo = _repo_root()
        return cls(
            database_url=_texto(
                "DATABASE_URL", "postgresql://planaveg:planaveg@127.0.0.1:55434/planaveg"
            ),
            gpkg_path=_caminho("GPKG_PATH"),
            gpkg_dir=_caminho("GPKG_DIR") or _pasta_gpkg(repo),
            contract_path=_caminho("CONTRACT_PATH")
            or Path(__file__).resolve().parent / "contracts/categorias.v1.json",
            geoserver_url=_texto("GEOSERVER_URL", "http://127.0.0.1:8085/geoserver"),
            geoserver_user=_texto("GEOSERVER_USER", "admin"),
            geoserver_password=_texto("GEOSERVER_PASSWORD", "planaveg"),
            geoserver_pg_host=_texto("GEOSERVER_PG_HOST", "db"),
            geoserver_pg_port=_inteiro("GEOSERVER_PG_PORT") or 5432,
            geoserver_pg_database=_texto("GEOSERVER_PG_DATABASE", "planaveg"),
            geoserver_pg_password=_texto("GEOSERVER_PG_PASSWORD", "geoserver_leitura"),
            gwc_cota_gb=_inteiro("GWC_COTA_GB", minimo=1),
            vigentes=_caminho("VERSOES_VIGENTES"),
        )
