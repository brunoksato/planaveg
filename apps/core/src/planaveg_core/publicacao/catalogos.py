"""Os catálogos que o portal lê: anos, níveis, arranjos (com as metas), filtros, dimensões, o que
falta e o arquivo vigente, com as versões. Os do contrato leem as tabelas `contrato_*`, na ordem do
contrato.
"""

from __future__ import annotations

from psycopg import sql

from planaveg_core import etapas
from planaveg_core.publicacao.nomes import View


def catalogos() -> list[View]:
    views = [
        View(
            "catalogo_ano",
            sql.SQL("\nSELECT ano_vs, camada, rotulo FROM contrato_ano ORDER BY ano_vs"),
            "Anos de VS | Cada ano de vegetação secundária da base, com a camada do GeoPackage "
            "de origem e o rótulo para o portal.",
            publicada=True,
        ),
        View(
            "catalogo_nivel",
            sql.SQL(
                """
                SELECT n.tier, n.nivel, n.grupo, g.titulo AS grupo_titulo, n.titulo,
                       h.hierarquia, h.categoria, n.cor, n.motivo_ausencia IS NULL AS presente,
                       n.motivo_ausencia
                FROM contrato_nivel n
                JOIN contrato_grupo g ON g.grupo = n.grupo
                LEFT JOIN contrato_hierarquia h ON h.tier = n.tier
                LEFT JOIN contrato_condicao_car c ON c.categoria = h.categoria
                ORDER BY n.tier, c.ordem NULLS FIRST
                """
            ),
            "Hierarquia Planaveg | Cada linha da hierarquia do Anexo 1: tier, código do nível, "
            "grupo, rótulo recebido, condição do CAR, cor de mapa e se o arquivo a materializa.",
            publicada=True,
        ),
        View(
            "catalogo_arranjo",
            sql.SQL(
                """
                SELECT prioridade, arranjo, titulo, criterio, cor, meta_ha, meta_ano,
                       motivo_ausencia
                FROM contrato_arranjo
                ORDER BY prioridade
                """
            ),
            "Arranjos de implementação | Os arranjos do Anexo 2 em ordem de prioridade, com o "
            "critério, a cor de mapa e a meta para 2030 (Figura 4 do relatório técnico). O "
            "último é o complementar, sem meta. motivo_ausencia: por que o arranjo fica com 0 ha.",
            publicada=True,
        ),
        View(
            "catalogo_filtro",
            sql.SQL(
                """
                SELECT ordem, filtro, grupo, titulo, subtitulo, tipo, espacial, status, nota, cor,
                       cql, tema
                FROM contrato_filtro
                ORDER BY ordem
                """
            ),
            "Filtros do relatório | Cada filtro espacial e quantitativo do relatório técnico, "
            "na ordem do relatório, com grupo, tipo, status (presente, parcial, vazio), nota e "
            "cor. cql é o filtro em CQL sobre as camadas de peças (o mesmo predicado do "
            "contrato). tema: o portal o oferece como tema (espacial e sem repetir um arranjo, "
            "que já é um caminho). As camadas de mapa de cada filtro estão em catalogo_camada.",
            publicada=True,
        ),
        View(
            "catalogo_dimensao",
            sql.SQL(
                "\nSELECT ordem, dimensao, grupo, titulo FROM contrato_dimensao ORDER BY ordem"
            ),
            "Dimensões dos quantitativos | Recortes de quantitativo_dimensao: UF, município, "
            "bacias e bioma, com o grupo do relatório.",
            publicada=True,
        ),
        View(
            "fonte_ausente",
            sql.SQL("\nSELECT codigo, grupo, descricao FROM contrato_fonte_ausente ORDER BY ordem"),
            "Fontes ausentes | O que o relatório pede e a base não traz: nível MonitoRAD, áreas "
            "prioritárias, desertificação, fitofisionomias e atributos de UC e TI.",
            publicada=True,
        ),
        View(
            "fonte_vigente",
            # As versões vão nas URLs, e o que tem versão fica um ano em cache: só valem se a
            # última publicação é desta entrega e nenhuma etapa que mexe nos dados começou ou
            # terminou depois do início dela (a que rodava junto conta quando termina). Durante
            # uma atualização da base, as duas ficam NULL e o portal pede tudo sem versão.
            sql.SQL(
                """
                WITH publicada AS (
                    SELECT x.id, x.entrega_id, x.iniciada_em, x.detalhe
                    FROM execucao x
                    WHERE x.etapa = {geoserver} AND x.ok
                    ORDER BY x.iniciada_em DESC
                    LIMIT 1
                ),
                vigente AS (
                    SELECT p.entrega_id, p.detalhe
                    FROM publicada p
                    WHERE NOT EXISTS (
                        SELECT 1 FROM execucao y
                        WHERE y.etapa IN ({etapas})
                          AND y.id <> p.id
                          AND coalesce(y.concluida_em, y.iniciada_em) > p.iniciada_em
                    )
                )
                SELECT e.nome_arquivo AS arquivo, e.sha256, e.tamanho_bytes,
                       c.versao AS contrato, e.concluida_em,
                       (SELECT sum(k.carregadas) FROM entrega_camada k
                         WHERE k.entrega_id = e.id)::bigint AS pecas,
                       v.detalhe->>'versao_mapa' AS versao_mapa,
                       v.detalhe->>'versao_dados' AS versao_dados
                FROM entrega e
                JOIN contrato_versao c ON c.id = e.contrato_versao_id
                LEFT JOIN vigente v ON v.entrega_id = e.id
                WHERE e.estado = 'pronta'
                """
            ).format(
                etapas=sql.SQL(", ").join(sql.Literal(e) for e in etapas.QUE_MEXEM_NOS_DADOS),
                geoserver=sql.Literal(etapas.GEOSERVER),
            ),
            "Base vigente | O arquivo carregado: nome, SHA-256, tamanho, versão do contrato, "
            "data da carga, número de peças e as versões publicadas do mapa (vai na URL dos "
            "tiles) e dos dados (vai na URL das consultas WFS e do WMS sem cache: muda com "
            "qualquer view ou com uma carga nova, então as respostas podem ficar em cache para "
            "sempre). As versões ficam NULL enquanto a base é atualizada (init-db ou load depois "
            "da última publicação, uma publicação que roda ou falhou depois dela, ou publicação "
            "de outra entrega): sem versão, nada fica em cache por muito tempo.",
            publicada=True,
        ),
    ]
    return views
