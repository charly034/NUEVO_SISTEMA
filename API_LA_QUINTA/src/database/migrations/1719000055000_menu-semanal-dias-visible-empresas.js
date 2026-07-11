// Agrega visible_empresas a menu_semanal_dias.
// Solo aplica a platos de canal 'local': controla si aparecen en el app de pedidos de empleados.
// Canal vianda: siempre visible (ignorar este campo).
// Default true para no romper slots existentes.
export const up = (pgm) => {
  pgm.addColumn('menu_semanal_dias', {
    visible_empresas: {
      type: 'boolean',
      notNull: true,
      default: true,
    },
  });
};

export const down = (pgm) => {
  pgm.dropColumn('menu_semanal_dias', 'visible_empresas');
};
