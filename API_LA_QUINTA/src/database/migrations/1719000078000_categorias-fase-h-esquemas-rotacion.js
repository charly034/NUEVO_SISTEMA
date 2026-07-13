// Fase H del teardown: esquemas de rotación flexibles por grupo de categoría.
// Amplía categoria_grupo con los parámetros de cada esquema, agrega la
// excepción manual por semana y marca el origen de las filas materializadas por
// rotación (para poder re-sembrar sin tocar las filas cargadas a mano).
//
// Esquemas soportados (columna criterio):
//   - siempre        : todas las semanas
//   - pares / impares: por nº de semana ISO del año
//   - cada_n         : cada `periodo` semanas desde la fecha ancla, con offset
//   - rango_fechas   : solo entre fecha_desde y fecha_hasta
//   - semana_mes     : la Nª semana del mes (semana_del_mes 1..5), opcionalmente
//                      solo en ciertos `meses`
//   - ciclo          : N grupos 'ciclo' se turnan (ya existía)

export function up(pgm) {
  pgm.sql(`
    ALTER TABLE categoria_grupo
      ADD COLUMN IF NOT EXISTS periodo         INTEGER NULL,
      ADD COLUMN IF NOT EXISTS fecha_desde      DATE NULL,
      ADD COLUMN IF NOT EXISTS fecha_hasta      DATE NULL,
      ADD COLUMN IF NOT EXISTS semana_del_mes   INTEGER NULL,
      ADD COLUMN IF NOT EXISTS meses            INTEGER[] NULL;

    -- Ampliar el criterio permitido (la constraint inline de Fase A se llama
    -- categoria_grupo_criterio_check).
    ALTER TABLE categoria_grupo DROP CONSTRAINT IF EXISTS categoria_grupo_criterio_check;
    ALTER TABLE categoria_grupo ADD CONSTRAINT categoria_grupo_criterio_check
      CHECK (criterio IN ('siempre', 'pares', 'impares', 'ciclo', 'cada_n', 'rango_fechas', 'semana_mes'));

    -- Excepción manual: fuerza un grupo para (menú, categoría) una semana puntual.
    CREATE TABLE IF NOT EXISTS categoria_grupo_seleccion_semana (
      id                 SERIAL PRIMARY KEY,
      menu_semanal_id    INTEGER NOT NULL REFERENCES menus_semanales(id) ON DELETE CASCADE,
      categoria_id       INTEGER NOT NULL REFERENCES categorias(id) ON DELETE CASCADE,
      categoria_grupo_id INTEGER NOT NULL REFERENCES categoria_grupo(id) ON DELETE CASCADE,
      created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (menu_semanal_id, categoria_id)
    );

    -- Origen de una fila materializada por rotación (para re-sembrar sin tocar
    -- las filas cargadas a mano, que tienen este campo NULL).
    ALTER TABLE menu_semanal_dias
      ADD COLUMN IF NOT EXISTS origen_categoria_grupo_id INTEGER NULL
        REFERENCES categoria_grupo(id) ON DELETE SET NULL;

    CREATE INDEX IF NOT EXISTS menu_semanal_dias_origen_grupo_idx
      ON menu_semanal_dias (origen_categoria_grupo_id);
  `);
}

export function down(pgm) {
  pgm.sql(`
    DROP INDEX IF EXISTS menu_semanal_dias_origen_grupo_idx;
    ALTER TABLE menu_semanal_dias DROP COLUMN IF EXISTS origen_categoria_grupo_id;
    DROP TABLE IF EXISTS categoria_grupo_seleccion_semana;
    ALTER TABLE categoria_grupo DROP CONSTRAINT IF EXISTS categoria_grupo_criterio_check;
    ALTER TABLE categoria_grupo ADD CONSTRAINT categoria_grupo_criterio_check
      CHECK (criterio IN ('siempre', 'pares', 'impares', 'ciclo'));
    ALTER TABLE categoria_grupo
      DROP COLUMN IF EXISTS periodo,
      DROP COLUMN IF EXISTS fecha_desde,
      DROP COLUMN IF EXISTS fecha_hasta,
      DROP COLUMN IF EXISTS semana_del_mes,
      DROP COLUMN IF EXISTS meses;
  `);
}
