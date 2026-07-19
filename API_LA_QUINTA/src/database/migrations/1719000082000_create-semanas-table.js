// Entidad `semanas`: reifica la semana como contenedor de primera clase. Antes
// la semana era una fecha suelta (`semana_inicio`/`fecha_inicio`) desparramada
// por varias tablas y unida solo por coincidencia de fecha. Identidad = el lunes
// (`fecha_inicio` UNIQUE); `fecha_fin` = lunes + 6.
//
// Fase S0 del plan "semana como raiz" (docs/ai/90-redesign-dominio-borrador.md):
// crea la tabla + el catalogo inicial a partir de los lunes ya presentes en los
// datos actuales. NO toca ninguna tabla vieja todavia (cero cambio de
// comportamiento). Las fases siguientes agregan `semana_id` a menus/pedidos y
// migran las lecturas.
//
// `date_trunc('week', d)` devuelve el lunes (semana ISO) para cualquier fecha,
// asi que el backfill queda normalizado a lunes aunque alguna fecha origen no lo
// fuera. La verificacion dura de "todas las fechas son lunes" es un pre-flight de
// la fase S1 (linking), no de S0.

export function up(pgm) {
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS semanas (
      id           serial PRIMARY KEY,
      fecha_inicio date NOT NULL UNIQUE,
      fecha_fin    date NOT NULL,
      created_at   timestamptz NOT NULL DEFAULT NOW(),
      updated_at   timestamptz NOT NULL DEFAULT NOW()
    );

    INSERT INTO semanas (fecha_inicio, fecha_fin)
    SELECT lunes, lunes + 6
    FROM (
      SELECT DISTINCT date_trunc('week', fecha_inicio)::date AS lunes FROM menus_semanales
      UNION
      SELECT DISTINCT date_trunc('week', semana_inicio)::date FROM pedidos
      UNION
      SELECT DISTINCT date_trunc('week', semana_inicio)::date FROM pedido_sugerencias
      UNION
      SELECT DISTINCT date_trunc('week', semana_inicio)::date FROM sugerencias_empleados
      UNION
      SELECT DISTINCT date_trunc('week', semana_inicio)::date FROM pedido_sugerencia_opciones
    ) t
    ON CONFLICT (fecha_inicio) DO NOTHING;
  `);
}

export function down(pgm) {
  pgm.sql(`DROP TABLE IF EXISTS semanas;`);
}
