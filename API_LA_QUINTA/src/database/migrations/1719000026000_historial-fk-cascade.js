export const up = (pgm) => {
  // 1. Limpiar duplicados antes de agregar unique constraint
  pgm.sql(`
    DELETE FROM historial_uso_platos
    WHERE id NOT IN (
      SELECT MIN(id)
      FROM historial_uso_platos
      GROUP BY plato_id, fecha_servicio, dia, opcion
    )
  `);

  // 2. Cambiar FK menu_semanal_id: SET NULL → CASCADE
  //    (cuando se borra un menú, se borran sus entradas de historial)
  pgm.dropConstraint('historial_uso_platos', 'historial_uso_platos_menu_semanal_id_fkey');
  pgm.addConstraint('historial_uso_platos', 'historial_uso_platos_menu_semanal_id_fkey', `
    FOREIGN KEY (menu_semanal_id)
    REFERENCES menus_semanales(id)
    ON DELETE CASCADE
  `);

  // 3. Unique constraint para evitar duplicados futuros
  pgm.addConstraint('historial_uso_platos', 'historial_uso_platos_unique', `
    UNIQUE (plato_id, fecha_servicio, dia, opcion)
  `);
};

export const down = (pgm) => {
  pgm.dropConstraint('historial_uso_platos', 'historial_uso_platos_unique');
  pgm.dropConstraint('historial_uso_platos', 'historial_uso_platos_menu_semanal_id_fkey');
  pgm.addConstraint('historial_uso_platos', 'historial_uso_platos_menu_semanal_id_fkey', `
    FOREIGN KEY (menu_semanal_id)
    REFERENCES menus_semanales(id)
    ON DELETE SET NULL
  `);
};
