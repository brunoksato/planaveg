"""As peças classificadas e as camadas de mapa delas.

`peca_classificada` (a peça da entrega pronta sem o desenho: o que o arquivo diz dela, com os
lugares e o nível das tabelas de referência, as marcas, o que a carga mede e a classificação,
calculada das regras do contrato), `peca_desenhada` (a peça com o desenho, para as camadas),
`peca_lugar` (a peça em cada lugar), `peca`, `peca_<ano>`, `espacial_<filtro>_<ano>`,
`municipio` e `peca_parte` (os polígonos de uma peça, para o clique).

O SQL é escrito por inteiro, com as colunas do modelo. As marcas são linhas (`peca_marca`), e cada
uma vira uma coluna booleana nas saídas, na ordem do contrato: essas listas são geradas dele. A UF
e o bioma voltam com o valor que o arquivo usa para fora dos limites oficiais (`fora`).
"""

from __future__ import annotations

from collections.abc import Sequence

from psycopg import sql

from planaveg_core.contrato import Camada, Contrato, Filtro
from planaveg_core.estilos import ESTILO_ARRANJO, ESTILO_MUNICIPIO, ESTILO_NIVEL, estilo_filtro
from planaveg_core.publicacao.nomes import View, nome_espacial, nome_peca_ano

_POR_LINHA = 6


def _lista(nomes: Sequence[str], recuo: str = "       ") -> sql.Composed:
    """Uma lista de colunas, `_POR_LINHA` por linha. Os nomes são os do contrato, que só aceita
    identificadores simples e não reservados: entram sem aspas, como no resto do SQL."""
    linhas = [nomes[i : i + _POR_LINHA] for i in range(0, len(nomes), _POR_LINHA)]
    return sql.SQL(",\n" + recuo).join(
        sql.SQL(", ").join(sql.SQL(n) for n in linha) for linha in linhas
    )


def colunas_de_peca(contrato: Contrato) -> sql.Composed:
    """As colunas publicadas das peças: a chave, a classificação, as do arquivo, uma por marca e
    as geometrias do mapa. O cômputo fica de fora: é o total do nível no ano, e somá-lo por peça
    daria um número sem sentido; ele está em `quantitativo_nivel`. As medidas da carga
    (`area_calculada_ha`, `partes`) também: o SQL de `peca` entra na versão do mapa."""
    return sql.SQL(
        """fid, ano_vs, origem_id, nivel, grupo, arranjo, situacao_cadastro,
       hierarquia, tier, categoria, area_ha, uf,
       bioma, municipio, cod_municipio, bacia, bacia_meso, regiao_hidrografica,
       {},
       sobreposicao,
       geom, geom_alta, ponto"""
    ).format(_lista(contrato.marcas()))


def _fora(contrato: Contrato, destino: str) -> sql.Composable:
    """O valor que o arquivo usa para fora dos limites oficiais na coluna (NULL se nenhum)."""
    for coluna in contrato.colunas:
        if coluna.destino == destino and coluna.fora is not None:
            return sql.Literal(coluna.fora)
    return sql.NULL


def classificada(contrato: Contrato) -> View:
    """A peça da entrega pronta sem o desenho, materializada: o que o arquivo diz dela (com o
    nome do município do IBGE e a região hidrográfica da mesobacia), as marcas, o que a carga
    mede no desenho (área calculada e polígonos) e a classificação: o nível (pelo rótulo
    recebido), o arranjo e os filtros de cada peça, das regras do contrato (`contrato_*`), e a
    esfera e o tipo das UCs onde ela está.

    Materializada: as regras são linhas, e testá-las a cada tile custaria caro. E tudo o que não
    desenha (as facetas, os quantitativos e o verify) lê só ela, sem
    passar pela tabela do desenho. O `load` e o `init-db` a recalculam antes das outras.
    """
    corpo = sql.SQL(
        """
        WITH marcada AS (
            -- As marcas de cada peça numa lista, na ordem do contrato.
            SELECT pm.entrega_id, pm.ano_vs, pm.origem_id,
                   array_agg(pm.marca ORDER BY cm.ordem) AS marcas
            FROM peca_marca pm
            JOIN contrato_marca cm ON cm.marca = pm.marca
            GROUP BY pm.entrega_id, pm.ano_vs, pm.origem_id
        ),
        recebida AS (
            -- A peça da entrega pronta, com o nível pelo rótulo, os lugares pelas referências e
            -- a UF e o bioma de quem cai fora dos limites com o valor que o arquivo usa.
            SELECT r.entrega_id, r.ano_vs, r.origem_id, r.hierarquia, h.tier, h.categoria,
                   r.area_ha, coalesce(r.uf::text, {fora_uf}) AS uf,
                   coalesce(r.bioma, {fora_bioma}) AS bioma, m.nome AS municipio,
                   r.cod_municipio::text AS cod_municipio, r.bacia, r.bacia_meso,
                   b.regiao_hidrografica, r.sobreposicao, n.nivel, n.grupo,
                   c.situacao AS situacao_cadastro,
                   coalesce(k.marcas, ARRAY[]::text[]) AS marcas
            FROM peca_recebida r
            JOIN entrega e ON e.id = r.entrega_id AND e.estado = 'pronta'
            JOIN contrato_hierarquia h ON h.hierarquia = r.hierarquia
            JOIN contrato_nivel n ON n.tier = h.tier
            LEFT JOIN contrato_condicao_car c ON c.categoria = h.categoria
            JOIN lugar_municipio m ON m.codigo = r.cod_municipio
            JOIN lugar_mesobacia b ON b.nome = r.bacia_meso
            LEFT JOIN marcada k
              ON k.entrega_id = r.entrega_id AND k.ano_vs = r.ano_vs
             AND k.origem_id = r.origem_id
        ),
        -- As condições de cada regra, com os valores numa lista.
        condicao_arranjo AS (
            SELECT c.arranjo, c.alternativa, c.campo, c.negada, array_agg(v.valor) AS valores
            FROM contrato_arranjo_condicao c
            JOIN contrato_arranjo_valor v
              ON v.arranjo = c.arranjo AND v.alternativa = c.alternativa
             AND v.condicao = c.condicao
            GROUP BY c.arranjo, c.alternativa, c.condicao, c.campo, c.negada
        ),
        condicao_filtro AS (
            SELECT c.filtro, c.alternativa, c.campo, c.negada, array_agg(v.valor) AS valores
            FROM contrato_filtro_condicao c
            JOIN contrato_filtro_valor v
              ON v.filtro = c.filtro AND v.alternativa = c.alternativa
             AND v.condicao = c.condicao
            GROUP BY c.filtro, c.alternativa, c.condicao, c.campo, c.negada
        ),
        -- Uma regra vale para a peça se ela atende todas as condições de alguma alternativa.
        arranjo_atendido AS (
            SELECT p.ano_vs, p.origem_id, a.prioridade, a.arranjo
            FROM recebida p
            CROSS JOIN condicao_arranjo c
            JOIN contrato_arranjo a ON a.arranjo = c.arranjo
            GROUP BY p.ano_vs, p.origem_id, a.prioridade, a.arranjo, c.alternativa
            HAVING bool_and(
                condicao_atendida(c.campo, c.valores, c.negada, p.nivel, NULL, p.marcas)
            )
        ),
        -- A peça fica no arranjo de maior prioridade cuja regra ela atende; sem nenhum, no
        -- complementar.
        primeiro_arranjo AS (
            SELECT DISTINCT ON (ano_vs, origem_id) ano_vs, origem_id, arranjo
            FROM arranjo_atendido
            ORDER BY ano_vs, origem_id, prioridade
        ),
        com_arranjo AS (
            SELECT p.*,
                   coalesce(t.arranjo, (SELECT arranjo FROM contrato_arranjo WHERE complementar))
                       AS arranjo
            FROM recebida p
            LEFT JOIN primeiro_arranjo t ON t.ano_vs = p.ano_vs AND t.origem_id = p.origem_id
        ),
        filtro_atendido AS (
            SELECT DISTINCT p.ano_vs, p.origem_id, c.filtro
            FROM com_arranjo p
            CROSS JOIN condicao_filtro c
            GROUP BY p.ano_vs, p.origem_id, c.filtro, c.alternativa
            HAVING bool_and(
                condicao_atendida(c.campo, c.valores, c.negada, p.nivel, p.arranjo, p.marcas)
            )
        ),
        -- Os filtros que a peça atende, na ordem do relatório.
        temas AS (
            SELECT t.ano_vs, t.origem_id, array_agg(t.filtro ORDER BY f.ordem) AS temas
            FROM filtro_atendido t
            JOIN contrato_filtro f ON f.filtro = t.filtro
            GROUP BY t.ano_vs, t.origem_id
        )
        -- A peça inteira, menos o desenho: as colunas recebidas, uma por marca, as medidas e a
        -- classificação.
        SELECT p.entrega_id, p.ano_vs, p.origem_id, p.hierarquia, p.tier, p.categoria,
               p.area_ha, p.uf, p.bioma, p.municipio, p.cod_municipio, p.bacia, p.bacia_meso,
               p.regiao_hidrografica,
               {colunas_das_marcas},
               p.sobreposicao, g.area_calculada_ha, g.partes, p.nivel, p.grupo, p.arranjo,
               p.situacao_cadastro, coalesce(t.temas, ARRAY[]::text[]) AS temas,
               array_remove(ARRAY[
                   CASE WHEN 'uc_federal' = ANY (p.marcas) THEN 'federal' END,
                   CASE WHEN 'uc_estadual' = ANY (p.marcas) THEN 'estadual' END,
                   CASE WHEN 'uc_municipal' = ANY (p.marcas) THEN 'municipal' END
               ], NULL) AS esferas_uc,
               array_remove(ARRAY[
                   CASE WHEN 'apa' = ANY (p.marcas) THEN 'apa' END,
                   CASE WHEN 'rppn' = ANY (p.marcas) THEN 'rppn' END,
                   CASE WHEN 'uc' = ANY (p.marcas) THEN 'outras' END
               ], NULL) AS tipos_uc,
               p.marcas
        FROM com_arranjo p
        JOIN peca_geometria g
          ON g.entrega_id = p.entrega_id AND g.ano_vs = p.ano_vs AND g.origem_id = p.origem_id
        LEFT JOIN temas t ON t.ano_vs = p.ano_vs AND t.origem_id = p.origem_id
        """
    ).format(
        fora_uf=_fora(contrato, "uf"),
        fora_bioma=_fora(contrato, "bioma"),
        colunas_das_marcas=sql.SQL(",\n               ").join(
            sql.SQL("{} = ANY (p.marcas) AS {}").format(sql.Literal(m), sql.SQL(m))
            for m in contrato.marcas()
        ),
    )
    return View(
        "peca_classificada",
        corpo,
        "Peças classificadas | Cada peça da entrega pronta sem o desenho: o que o arquivo diz "
        "dela (peca_recebida, com o nome do município do IBGE e a região hidrográfica da "
        "mesobacia), uma coluna por marca (peca_marca), a área calculada e os polígonos "
        "(peca_geometria) e a classificação: o nível e o grupo (pelo rótulo hierarquia_planaveg), "
        "o arranjo de implementação, a situação do cadastro no CAR com o nome da planilha de "
        "nomenclatura e os filtros do relatório que ela atende (temas, na ordem do relatório), "
        "calculados das regras do contrato (as tabelas contrato_*), e a esfera e o tipo das UCs "
        "onde ela está. Não é publicada.",
        materializada=True,
        chave=("ano_vs", "origem_id"),
    )


def desenhada() -> View:
    """A peça com o desenho: a classificada mais as geometrias do mapa, para as camadas."""
    corpo = sql.SQL(
        """
        -- fid: ano_vs × 10⁹ + o fid do GeoPackage, para as peças de anos diferentes não colidirem.
        SELECT g.ano_vs::bigint * 1000000000 + g.origem_id AS fid, c.*,
               g.geom, g.geom_alta, g.ponto
        FROM peca_geometria g
        JOIN peca_classificada c
          ON c.entrega_id = g.entrega_id AND c.ano_vs = g.ano_vs AND c.origem_id = g.origem_id
        """
    )
    return View(
        "peca_desenhada",
        corpo,
        "Peças desenhadas | Cada peça classificada (peca_classificada) com as geometrias do mapa "
        "(peca_geometria): a cópia em EPSG:4674, a simplificada e o centroide. Não é "
        "publicada: as camadas são peca, peca_<ano> e espacial_<filtro>_<ano>.",
    )


def lugar() -> View:
    """Uma linha por peça e dimensão do contrato, com a chave e o rótulo do valor. O município
    tem o rótulo Bonito (MS), com a UF do código, e a bacia, a mesobacia entre parênteses quando
    ela tem outro nome."""
    corpo = sql.SQL(
        """
        SELECT p.ano_vs, p.origem_id, l.dimensao, l.chave, l.rotulo
        FROM peca_classificada p
        JOIN lugar_municipio m ON m.codigo = p.cod_municipio
        JOIN lugar_uf u ON u.codigo = m.uf
        CROSS JOIN LATERAL (
            SELECT CASE WHEN p.bacia = p.bacia_meso THEN p.bacia
                        ELSE p.bacia || ' (' || p.bacia_meso || ')' END AS bacia
        ) b
        CROSS JOIN LATERAL (VALUES
            ('uf', p.uf, p.uf),
            ('municipio', p.cod_municipio, p.municipio || ' (' || u.sigla || ')'),
            ('bacia', b.bacia, b.bacia),
            ('bacia_meso', p.bacia_meso, p.bacia_meso),
            ('regiao_hidrografica', p.regiao_hidrografica, p.regiao_hidrografica),
            ('bioma', p.bioma, p.bioma)
        ) AS l(dimensao, chave, rotulo)
        """
    )
    return View(
        "peca_lugar",
        corpo,
        "Peças por lugar | Cada peça em cada dimensão do contrato (UF, município, bacias, região "
        "hidrográfica e bioma), com a chave do valor e o rótulo dele. O município tem o código "
        "como chave e o rótulo Bonito (MS); a bacia tem o mesmo texto como chave e como rótulo: "
        "o nome e, entre parênteses, a mesobacia, quando ela tem outro nome, porque o arquivo "
        "repete nomes de bacia. Não é publicada.",
    )


def _espacial(filtro: Filtro, camada: Camada, colunas: sql.Composed) -> View:
    """As peças de um ano que atendem o filtro (ele está nos temas delas), com as colunas de
    `peca`."""
    resumo = f"{filtro.grupo}: {filtro.subtitulo or filtro.titulo}."
    if filtro.nota:
        resumo += f" {filtro.nota}"
    return View(
        nome_espacial(filtro, camada.ano_vs),
        sql.SQL("\nSELECT {}\nFROM peca_desenhada\nWHERE ano_vs = {} AND {} = ANY (temas)").format(
            colunas, sql.Literal(camada.ano_vs), sql.Literal(filtro.codigo)
        ),
        f"{filtro.titulo} — {camada.rotulo} | {resumo}",
        publicada=True,
        espacial=True,
        estilos=(estilo_filtro(filtro.codigo),),
        tiles=True,
    )


def views_de_peca(contrato: Contrato) -> list[View]:
    colunas = colunas_de_peca(contrato)
    estilos = (ESTILO_NIVEL, ESTILO_ARRANJO)
    views = [
        View(
            "peca",
            sql.SQL("\nSELECT {}\nFROM peca_desenhada").format(colunas),
            "Peças Planaveg (todos os anos) | Todas as peças categorizadas de todos os anos de "
            "VS, com nível, arranjo, situação do cadastro no CAR e marcas. Filtre por ano_vs e "
            "por qualquer marca, nível ou arranjo (CQL). Some area_ha dentro de um ano; anos são "
            "retratos e não se somam.",
            publicada=True,
            espacial=True,
            estilos=estilos,
        )
    ]
    camadas = sorted(contrato.camadas, key=lambda c: c.ano_vs)
    views.extend(
        View(
            nome_peca_ano(camada.ano_vs),
            sql.SQL("\nSELECT * FROM peca WHERE ano_vs = {}").format(sql.Literal(camada.ano_vs)),
            f"Peças Planaveg {camada.rotulo} | Todas as peças categorizadas de "
            f"{camada.rotulo} (camada {camada.origem}), coloridas por nível; o estilo "
            f"{ESTILO_ARRANJO} as colore por arranjo.",
            publicada=True,
            espacial=True,
            estilos=estilos,
            tiles=True,
            familia="pecas",
            estilos_do_portal=(ESTILO_NIVEL,),
        )
        for camada in camadas
    )
    for filtro in contrato.filtros:
        if filtro.espacial:
            views.extend(_espacial(filtro, camada, colunas) for camada in camadas)
    return views


def partes() -> View:
    """Cada polígono de cada peça da entrega pronta, com a área dele: o arquivo junta numa peça
    todos os polígonos com os mesmos atributos no município, na bacia, no bioma e na UF, e o
    clique mostra o polígono clicado.

    As duas geometrias se desmontam juntas (`ROWS FROM`), na mesma ordem: a parte em EPSG:4674
    vai ao mapa, e a área sai da mesma parte no Albers, como a da peça. Sem índice nas partes,
    a view serve uma peça por vez: o GeoServer a publica com `ano_vs` e `origem_id` obrigatórios
    na URL, e o índice do desenho por ano e fid acha a peça.
    """
    corpo = sql.SQL(
        """
        -- fid: o da peça × 10⁶ + o número da parte (a maior peça tem 16.591 partes).
        SELECT (p.ano_vs::bigint * 1000000000 + p.origem_id) * 1000000 + d.caminho[1] AS fid,
               p.ano_vs::bigint * 1000000000 + p.origem_id AS fid_peca, p.ano_vs, p.origem_id,
               d.caminho[1] AS parte, p.partes, ST_Area(d.geom_albers) / 10000.0 AS area_ha,
               d.geom::geometry(Polygon, 4674) AS geom
        FROM peca_geometria p
        JOIN entrega e ON e.id = p.entrega_id AND e.estado = 'pronta'
        CROSS JOIN LATERAL ROWS FROM (ST_Dump(p.geom), ST_Dump(p.geom_albers))
            AS d(caminho, geom, caminho_albers, geom_albers)
        """
    )
    return View(
        "peca_parte",
        corpo,
        "Polígonos das peças | Cada polígono de uma peça, com a área dele em hectares (medida "
        "no Albers) e quantos a peça tem (partes): o arquivo junta numa peça todos os polígonos "
        "com os mesmos atributos no município e na bacia. Responde uma peça por vez, com o "
        "ano_vs e o origem_id dela na URL (viewparams=ano_vs:2024;origem_id:14537).",
        publicada=True,
        espacial=True,
        parametros=("ano_vs", "origem_id"),
    )


def municipio() -> View:
    """A extensão das peças de cada município, com o nome do IBGE, a UF do código e o rótulo. O
    código IBGE é a chave da camada (`fid`)."""
    corpo = sql.SQL(
        """
        SELECT m.codigo::bigint AS fid, m.codigo::text AS cod_municipio,
               m.nome AS municipio, u.sigla::text AS uf, m.nome || ' (' || u.sigla || ')' AS rotulo,
               normalizar_busca(m.nome || ' (' || u.sigla || ')') AS busca,
               ST_MakeEnvelope(ST_XMin(p.e), ST_YMin(p.e), ST_XMax(p.e), ST_YMax(p.e), 4674)
                   ::geometry(Polygon, 4674) AS geom
        FROM lugar_municipio m
        JOIN lugar_uf u ON u.codigo = m.uf
        JOIN (
            SELECT c.cod_municipio, ST_Extent(g.geom) AS e
            FROM peca_classificada c
            JOIN peca_geometria g
              ON g.entrega_id = c.entrega_id AND g.ano_vs = c.ano_vs
             AND g.origem_id = c.origem_id
            GROUP BY c.cod_municipio
        ) p ON p.cod_municipio = m.codigo::text
        """
    )
    return View(
        "municipio",
        corpo,
        "Municípios com peças | Retângulo envolvente das peças de cada município, para busca "
        "por nome e zoom, com o nome do IBGE. Não é o limite oficial: o arquivo não traz a malha "
        "municipal. busca é o rótulo como a busca pelo nome o compara: sem acento, em "
        "minúsculas, só com letras, dígitos, espaço, hífen e apóstrofo.",
        materializada=True,
        publicada=True,
        espacial=True,
        estilos=(ESTILO_MUNICIPIO,),
        chave=("cod_municipio",),
    )
