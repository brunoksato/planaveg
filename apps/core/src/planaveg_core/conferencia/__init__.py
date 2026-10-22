"""Invariantes do planaveg_core (`verify`), conferidas contra o banco carregado.

Cada verificação é uma consulta SQL nomeada que devolve (ok, detalhe). O comando
`planaveg-core verify` falha (exit 1) se uma reprovar sem ser aceita (`--aceitar`). Os testes
de integração rodam as mesmas, menos a sobreposição entre peças (minutos na base inteira), que
fica pulada como no `--rapido`. As que dependem do ano valem para cada ano de VS carregado.

O arquivo é o resultado da metodologia, não os insumos: o core não recalcula o
cômputo, mas confere que os números recebidos se sustentam na geometria recebida (área de
cada peça, total de cada nível, sobreposição entre peças) e que a classificação do
contrato cobre todas as peças.

Módulos: `base`, `carga`, `geometrias`, `classificacao`, `publicacao` e `todas` (a ordem).
"""

from planaveg_core.conferencia.base import Verificacao
from planaveg_core.conferencia.todas import INVARIANTES, verificar

__all__ = ["INVARIANTES", "Verificacao", "verificar"]
