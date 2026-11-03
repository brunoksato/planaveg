-- Gerado por `planaveg-core modelagem` do contrato 1.0.0: não edite à mão. Depois de 1_tabelas.sql.

-- Funções: a que lê a geometria na carga, a que normaliza um nome para a busca e a que testa uma
-- condição das regras do contrato numa peça.

-- STABLE, não IMMUTABLE: lê spatial_ref_sys, que pode mudar entre consultas.
CREATE OR REPLACE FUNCTION geom_de_origem(wkb bytea, srid integer)
RETURNS geometry
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    g geometry;
BEGIN
    IF wkb IS NULL THEN
        RETURN NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM spatial_ref_sys WHERE spatial_ref_sys.srid = geom_de_origem.srid) THEN
        RAISE EXCEPTION 'srid de origem nao registrado neste planaveg_core: %', srid
            USING ERRCODE = '22023';
    END IF;
    g := ST_Multi(ST_Force2D(ST_SetSRID(ST_GeomFromWKB(wkb), srid)));
    IF g IS NULL OR ST_IsEmpty(g) THEN
        RETURN NULL;
    END IF;
    RETURN g;
END;
$$;

-- O texto como o portal compara a busca pelo nome (o termoDeBusca dele): sem acento, em
-- minúsculas, só com letras, dígitos, espaço, hífen e apóstrofo (o curvo vira o reto), sem
-- espaço repetido. Assim "para" acha "Pará (PA)", e "bonito ms" acha "Bonito (MS)". O translate
-- traz as letras do português, sem depender da extensão unaccent, e tira o acento antes do
-- lower: num banco com LC_CTYPE C, o lower só conhece as letras sem acento.
CREATE OR REPLACE FUNCTION normalizar_busca(texto text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
    SELECT btrim(regexp_replace(
               regexp_replace(
                   lower(translate(texto,
                       'áàâãäéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ‘’',
                       'aaaaaeeeeiiiiooooouuuucnAAAAAEEEEIIIIOOOOOUUUUCN''''')),
                   '[^a-z0-9 ''-]', '', 'g'),
               ' {2,}', ' ', 'g'))
$$;

-- Uma condição de regra sobre uma peça: ter alguma das marcas, ter um dos níveis ou estar num
-- dos arranjos de valores; negada, o contrário. Uma peça sem nível não atende condição de nível.
CREATE OR REPLACE FUNCTION condicao_atendida(
    campo text, valores text[], negada boolean, nivel text, arranjo text, marcas text[]
)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
    SELECT coalesce(CASE campo
                        WHEN 'marca' THEN marcas && valores
                        WHEN 'nivel' THEN nivel = ANY (valores)
                        WHEN 'arranjo' THEN arranjo = ANY (valores)
                    END, false) <> negada
$$;
