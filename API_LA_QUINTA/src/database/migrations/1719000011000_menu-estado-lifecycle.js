export const up = (pgm) => {
  pgm.createType('menu_estado', ['borrador', 'publicado', 'cerrado']);

  pgm.addColumn('menus_semanales', {
    estado: {
      type: 'menu_estado',
      notNull: true,
      default: 'borrador',
    },
    fecha_limite_pedidos: {
      type: 'timestamp',
    },
    publicado_at: {
      type: 'timestamp',
    },
    cerrado_at: {
      type: 'timestamp',
    },
  });

  pgm.createIndex('menus_semanales', 'estado');

  // Los menús existentes ya tienen datos reales → los marcamos como publicados
  pgm.sql(`UPDATE menus_semanales SET estado = 'publicado', publicado_at = NOW()`);
};

export const down = (pgm) => {
  pgm.dropColumn('menus_semanales', 'estado');
  pgm.dropColumn('menus_semanales', 'fecha_limite_pedidos');
  pgm.dropColumn('menus_semanales', 'publicado_at');
  pgm.dropColumn('menus_semanales', 'cerrado_at');
  pgm.dropType('menu_estado');
};
