"""Publicação no GeoServer via REST: workspace, datastore, estilos e uma camada por view publicada.

O datastore aponta para o schema public com o papel `geoserver_leitura`, que só lê o que é
publicado. As camadas de mapa declaram `fid` como chave em `gt_pk_metadata`, por isso o
feature type não precisa de lista de atributos: o GeoServer lê colunas, geometria e chave do
próprio banco. As tabelas sem geometria (quantitativos, série, catálogo) também viram feature
types: o portal as lê por WFS (`GetFeature`, `outputFormat=application/json`). A view com
parâmetros (`peca_parte`, os polígonos de uma peça) vira uma SQL view do GeoServer, com a chave
e os parâmetros obrigatórios na própria definição.

A caixa não vem do GeoServer: ele só a calcula ao criar a camada e grava `[0, -1]` se a view
estiver vazia. Ela vai declarada, medida no banco (`catalogo_camada`); as tabelas sem
geometria recebem a caixa do Brasil. Tudo é idempotente: uma camada existente é atualizada,
um estilo só é regravado quando o SLD muda (gravar apaga os tiles das camadas dele), e o estilo e
a camada que saíram do contrato são removidos.

Módulos: `recursos` (datastore, camadas e estilos), `versoes` (o que entra em cada versão) e
`publicar` (a publicação inteira).
"""

from planaveg_core.geoserver.publicar import Publicacao, publicar_geoserver
from planaveg_core.geoserver.recursos import STORE, obsoletos
from planaveg_core.geoserver.versoes import desenho_do_mapa
from planaveg_core.rest import WORKSPACE

__all__ = [
    "STORE",
    "WORKSPACE",
    "Publicacao",
    "desenho_do_mapa",
    "obsoletos",
    "publicar_geoserver",
]
