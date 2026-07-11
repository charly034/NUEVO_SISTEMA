// Elimina la columna `plan` (enum empresa_plan legacy) de empresas.
// Los datos ya fueron migrados a `plan_id` (FK → planes_vianda) en la migración 1719000043000.
export const up = (pgm) => {
  pgm.sql('ALTER TABLE empresas DROP COLUMN IF EXISTS plan');
  pgm.sql('DROP TYPE IF EXISTS empresa_plan');
};

export const down = (pgm) => {
  pgm.sql("CREATE TYPE empresa_plan AS ENUM ('basico', 'con_postre', 'con_postre_bebida')");
  pgm.sql("ALTER TABLE empresas ADD COLUMN plan empresa_plan NOT NULL DEFAULT 'basico'");
};
