export const up = (pgm) => {
  pgm.sql(`
    WITH conservar AS (
      SELECT id
      FROM menus_semanales
      WHERE estado = 'publicado'
      ORDER BY
        CASE WHEN CURRENT_DATE BETWEEN fecha_inicio AND fecha_fin THEN 0
             WHEN fecha_inicio > CURRENT_DATE THEN 1
             ELSE 2 END,
        CASE WHEN fecha_inicio >= CURRENT_DATE THEN fecha_inicio END ASC,
        fecha_inicio DESC
      LIMIT 1
    )
    UPDATE menus_semanales
    SET estado = 'cerrado', cerrado_at = COALESCE(cerrado_at, NOW()), updated_at = NOW()
    WHERE estado = 'publicado'
      AND id NOT IN (SELECT id FROM conservar);
  `);

  pgm.createIndex('menus_semanales', 'estado', {
    name: 'menus_semanales_unico_publicado',
    unique: true,
    where: "estado = 'publicado'",
  });
};

export const down = (pgm) => {
  pgm.dropIndex('menus_semanales', 'estado', {
    name: 'menus_semanales_unico_publicado',
  });
};
