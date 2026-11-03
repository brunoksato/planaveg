"""Os nomes das etapas: cada um é um subcomando da CLI e a `etapa` gravada em `execucao`.

Ficam aqui, na base, porque quase todo pacote os usa: o registro, a `fonte_vigente`, as
versões, a conferência e o `status`. `tests/test_publicacao.py` confere que são subcomandos.
"""

INIT_DB = "init-db"
LOAD = "load"
VERIFY = "verify"
GEOSERVER = "geoserver"

REGISTRADAS = (INIT_DB, LOAD, VERIFY, GEOSERVER)
"""As que gravam uma linha em `execucao`, na ordem de uma base nova."""
QUE_MEXEM_NOS_DADOS = (INIT_DB, LOAD, GEOSERVER)
"""As que mudam o que o GeoServer responde (as views, as peças e, a publicação, os estilos e as
camadas): enquanto uma delas não tiver uma publicação bem-sucedida depois (ou, a publicação,
enquanto roda ou se falhou), a `fonte_vigente` não expõe versão."""
