// Permite múltiples menús publicados simultáneamente.
// Antes solo podía haber uno (índice único parcial). Ahora el admin puede
// publicar la semana siguiente sin cerrar la actual, y los clientes ven
// un selector para pedir en cualquiera de las semanas disponibles.
export const up = (pgm) => {
  pgm.dropIndex('menus_semanales', 'estado', {
    name: 'menus_semanales_unico_publicado',
  });
};

export const down = (pgm) => {
  pgm.createIndex('menus_semanales', 'estado', {
    name: 'menus_semanales_unico_publicado',
    unique: true,
    where: "estado = 'publicado'",
  });
};
