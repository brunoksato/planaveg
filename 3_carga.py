# /// script
# requires-python = ">=3.13"
# dependencies = ["psycopg[binary]"]
# ///

"""Joga as áreas do GeoPackage na tabela area_mapeada.

Uso:
    export DATABASE_URL=postgresql://usuario:senha@servidor:5432/banco
    uv run 3_carga.py /caminho/Planaveg_2026_Categorias_Visualizacao.gpkg

Tudo numa transação só: ou entra a base inteira, ou nada muda. O arranjo de cada área o próprio
PostgreSQL calcula ao gravar (a coluna arranjo de area_mapeada, em 1_tabelas.sql).
"""

import os
import sqlite3
import sys
import time
from pathlib import Path

import psycopg
from psycopg import sql

# Qual camada do GeoPackage vira qual ano na tabela.
CAMADAS = {
    2022: "Planaveg_2026_Visualizacao_vs22q",
    2024: "Planaveg_2026_Visualizacao_vs2224q",
}

# Coluna do arquivo → coluna da tabela area_mapeada. As colunas in_ são as marcas: no arquivo
# vêm com a sigla quando a área tem a marca e vazias quando não tem; na tabela viram sim ou não.
# in_ = “está em”: a coluna diz sim ou não se a área fica dentro daquele lugar (in_car = a área está em imóvel do CAR).
COLUNAS = {
    "fid": "id_no_arquivo",
    "hierarquia_planaveg": "linha_hierarquia",
    "tier": "nivel",
    "categoria": "situacao_car",
    "computo": "total_linha_hierarquia_ha",
    "Area_ha": "area_ha",
    "UF": "uf",
    "Bioma": "bioma",
    "Municipio": "municipio",
    "cod_municipio": "codigo_ibge_municipio",
    "Bacia": "bacia",
    "Bacia_meso": "mesobacia",
    "Regiao_Hidrografica": "regiao_hidrografica",
    "CAR": "in_car",
    "CAR_Habilitado": "in_car_habilitado",
    "CAR_Analisado": "in_car_analisado",
    "CAR_Nao_Analisado": "in_car_nao_analisado",
    "CAR_regularizacao": "in_car_regularizacao",
    "APP_Habilitado": "in_app_car_habilitado",
    "APP_Analisado": "in_app_car_analisado",
    "APP_Nao_Analisado": "in_app_car_nao_analisado",
    "RL_Habilitado": "in_rl_car_habilitado",
    "RL_Analisado": "in_rl_car_analisado",
    "RL_Nao_Analisado": "in_rl_car_nao_analisado",
    "AUR_Habilitado": "in_aur_car_habilitado",
    "AUR_Analisado": "in_aur_car_analisado",
    "AUR_Nao_Analisado": "in_aur_car_nao_analisado",
    "PROJ": "in_projeto_recuperacao",
    "Licenciamento_Ambiental": "in_licenciamento_ambiental",
    "Reparacao_Danos": "in_reparacao_danos",
    "Area_Embargada": "in_area_embargada",
    "Outras_Areas": "in_outras_areas_recooperar",
    "Embargo_PANGIA": "in_embargo_pangia",
    "GEF_Terrestre": "in_gef_terrestre",
    "Restauracao_Ecologica": "in_restauracao_ecologica",
    "ORR": "in_observatorio_restauracao",
    "Manguezal": "in_manguezal",
    "APA": "in_apa",
    "RPPN": "in_rppn",
    "UC": "in_uc",
    "UC_federal": "in_uc_federal",
    "UC_estadual": "in_uc_estadual",
    "UC_municipal": "in_uc_municipal",
    "TI": "in_terra_indigena",
    "AS_": "in_assentamento",
    "QL": "in_territorio_quilombola",
    "Sobreposicao": "siglas_sobreposicao",
}

# Tamanho, em bytes, do envelope que o GeoPackage pode pôr no cabeçalho de cada desenho.
ENVELOPE = {0: 0, 1: 32, 2: 48, 3: 48, 4: 64}

INICIO = time.monotonic()

def wkb(geom):
    """Tira o cabeçalho do GeoPackage e devolve o desenho em WKB, o formato que o PostGIS lê.

    O cabeçalho tem 8 bytes fixos e um envelope opcional, cujo tamanho vem nos bits 1 a 3 do
    quarto byte.
    """
    envelope = (geom[3] >> 1) & 0b111
    return geom[8 + ENVELOPE[envelope] :]


def carregar(gpkg, banco, ano, camada):
    linhas = gpkg.execute(f'SELECT * FROM "{camada}"')
    nomes = []

    for coluna in linhas.description:
        nomes.append(coluna[0])

    origens = []
    destinos = []
    novas = []
    for nome in nomes:
        if nome == "geom":
            continue
        if nome in COLUNAS:
            origens.append(nome)
            destinos.append(COLUNAS[nome])
        else:
            novas.append(nome)

    if novas:
        sys.exit(f"{camada} tem colunas que a carga não conhece: {novas}. Ponha cada uma em"
                 " COLUNAS e crie a coluna na tabela area_mapeada (1_tabelas.sql).")

    # Uma coluna e um %s para cada atributo que veio do arquivo.
    colunas = []
    marcadores = []
    for destino in destinos:
        colunas.append(sql.Identifier(destino))
        marcadores.append(sql.Placeholder())

    # Cada linha do VALUES preenche a coluna na mesma posição do INSERT. O PostGIS lê o WKB no
    # Albers (SRID 100000, registrado no spatial_ref_sys) e converte para 4674. O arquivo traz
    # MultiPolygon; a coluna geom recusa ponto, linha ou outro SRID, e a carga para.
    insert = sql.SQL("""
        INSERT INTO area_mapeada (ano_mapeamento, {colunas}, geom)
        VALUES (
            %s,
            {marcadores},
            ST_Transform(ST_GeomFromWKB(%s, 100000), 4674)
        )
    """).format(
        colunas=sql.SQL(", ").join(colunas),
        marcadores=sql.SQL(", ").join(marcadores),
    )

    def valores():
        for linha in linhas:
            area = dict(zip(nomes, linha))
            registro = [ano]
            for origem in origens:
                valor = area[origem]
                if COLUNAS[origem].startswith("in_"):
                    valor = bool(valor)
                registro.append(valor)
            registro.append(wkb(area["geom"]))
            yield registro

    with banco.cursor() as cursor:
        cursor.executemany(insert, valores())
        print(f"{ano}: {cursor.rowcount} áreas de {camada}")


def main():
    if len(sys.argv) != 2:
        sys.exit("uso: uv run 3_carga.py arquivo.gpkg")

    if not os.environ.get("DATABASE_URL"):
        sys.exit("defina a variável de ambiente DATABASE_URL")

    arquivo = Path(sys.argv[1]).resolve()
    gpkg = sqlite3.connect(f"{arquivo.as_uri()}?mode=ro", uri=True)  # só leitura

    with psycopg.connect(os.environ["DATABASE_URL"]) as banco:
        banco.execute("TRUNCATE area_mapeada")

        for ano, camada in CAMADAS.items():
            carregar(gpkg, banco, ano, camada)

        banco.execute("ANALYZE area_mapeada")
    # Saindo do "with" sem erro, o psycopg faz o COMMIT. Com erro, faz o ROLLBACK.
    print(f"[{time.monotonic() - INICIO:5.0f} s] pronto", flush=True)


if __name__ == "__main__":
    main()
