"""O banco do planaveg_core: conexão, estrutura (`init-db`), carga e registro das etapas.

Tudo vive no schema padrão (public). A estrutura das tabelas vem das migrações
(`sql/migracoes/`, `migracoes`), aplicadas uma vez cada, na ordem. O `init-db` aplica, nesta
ordem: a extensão e o SRS e os registros (`sql/000` e `010`), as migrações que faltam e as funções
(`030`); depois, já registrado em `execucao`, a versão do contrato (`contrato_versao`), as regras e
os municípios acertados no lugar (`regras`), as views geradas do contrato (pacote `publicacao`),
derrubadas e recriadas pelo registro `objeto_gerado`, o papel de leitura, as permissões, as chaves
do GeoServer e o cálculo das materializadas. Sem `recriar`, nada carregado se perde. A `modelagem`
escreve os mesmos comandos em arquivos de SQL puro.

Módulos: `conexao`, `migracoes`, `estrutura`, `regras`, `modelagem`, `papel`, `pecas` (o SQL da
carga), `registro`, `publicacoes` (o histórico das publicações) e `vigentes` (as versões vigentes
num diretório, para o nginx; só o `registro` o usa).
"""

from planaveg_core.banco.conexao import conectar
from planaveg_core.banco.estrutura import (
    aplicar_estrutura,
    atualizar_quantitativos,
    preparar,
    script,
    textos_fixos,
)
from planaveg_core.banco.migracoes import conferir_migracoes
from planaveg_core.banco.modelagem import modelagem
from planaveg_core.banco.papel import PAPEL_LEITURA
from planaveg_core.banco.pecas import (
    CONFERENCIAS,
    LUGARES,
    MESOBACIA_EM_OUTRA_REGIAO,
    NOMES_DE_MUNICIPIO,
    POUSO,
    TABELAS_DA_CARGA,
    TOLERANCIA_ALTA,
    TOLERANCIA_HA,
    computo,
    computo_divergente,
    insercao_das_pecas,
    lista_da_carga,
)
from planaveg_core.banco.publicacoes import registrar_publicacao
from planaveg_core.banco.registro import (
    conferir_contrato,
    contagens_da_carga,
    entrega_pronta,
    registrar,
    ultimo_detalhe,
)
from planaveg_core.banco.regras import conferir_contrato_vigente

__all__ = [
    "CONFERENCIAS",
    "LUGARES",
    "MESOBACIA_EM_OUTRA_REGIAO",
    "NOMES_DE_MUNICIPIO",
    "PAPEL_LEITURA",
    "POUSO",
    "TABELAS_DA_CARGA",
    "TOLERANCIA_ALTA",
    "TOLERANCIA_HA",
    "aplicar_estrutura",
    "atualizar_quantitativos",
    "computo",
    "computo_divergente",
    "conectar",
    "conferir_contrato",
    "conferir_contrato_vigente",
    "conferir_migracoes",
    "contagens_da_carga",
    "entrega_pronta",
    "insercao_das_pecas",
    "lista_da_carga",
    "modelagem",
    "preparar",
    "registrar",
    "registrar_publicacao",
    "script",
    "textos_fixos",
    "ultimo_detalhe",
]
