// Tabla de configuración genérica clave-valor (JSONB) para ajustes de UI/negocio
// que no justifican su propia tabla. Primer uso: colores de las celdas del
// resumen semanal (personalizables por el admin, persistidos y compartidos
// entre todos los admins/dispositivos).
//
// Default sembrado: paleta "Sobrio" (verde de marca / índigo / naranja),
// alineada con el sistema de diseño del panel. El estado "ninguno" queda
// blanco (no configurable).

export function up(pgm) {
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS configuracion (
      clave       TEXT PRIMARY KEY,
      valor       JSONB NOT NULL,
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    INSERT INTO configuracion (clave, valor)
    VALUES (
      'menu_resumen_colores',
      '{"vianda":"#2b7330","porKilo":"#6366f1","ambos":"#f97316"}'::jsonb
    )
    ON CONFLICT (clave) DO NOTHING;
  `);
}

export function down(pgm) {
  pgm.sql(`DROP TABLE IF EXISTS configuracion;`);
}
