-- Os dois registros que o init-db lê antes de tudo. Os dois são reaplicáveis.

-- As migrações aplicadas (sql/migracoes/): o número, o nome e o SHA-256 do arquivo. O init-db
-- aplica as que faltam, na ordem, e para se uma já aplicada mudou.
CREATE TABLE IF NOT EXISTS migracao (
    numero integer PRIMARY KEY CHECK (numero > 0),
    nome text NOT NULL,
    sha256 char(64) NOT NULL,
    aplicada_em timestamptz NOT NULL DEFAULT clock_timestamp()
);

-- As views que o init-db gerou. Tudo vive no schema padrão (public): a separação entre o que é
-- insumo, regra e publicação fica no nome e nas permissões de cada objeto, e este registro diz
-- quais views o init-db criou. Só elas são derrubadas e recriadas, nunca as views do PostGIS,
-- como geometry_columns, que também moram em public.
CREATE TABLE IF NOT EXISTS objeto_gerado (
    nome text PRIMARY KEY,
    tipo text NOT NULL CHECK (tipo IN ('view', 'matview')),
    ordem integer NOT NULL,
    publicada boolean NOT NULL,
    espacial boolean NOT NULL
);
