// Elimina visible_empresas de menu_semanal_dias: campo muerto, confirmado sin
// lectores (se escribia en agregarPlatoDia pero ningun filtro de backend ni
// frontend lo leia). La visibilidad real por empresa la resuelven
// menu_empresa_visibilidad y plato_empresa_visibilidad (ver
// pedidos.repository.js FILTRO_VISIBILIDAD_SLOT/_PLATO).
export const up = (pgm) => {
  pgm.dropColumn('menu_semanal_dias', 'visible_empresas');
};

export const down = (pgm) => {
  pgm.addColumn('menu_semanal_dias', {
    visible_empresas: {
      type: 'boolean',
      notNull: true,
      default: true,
    },
  });
};
