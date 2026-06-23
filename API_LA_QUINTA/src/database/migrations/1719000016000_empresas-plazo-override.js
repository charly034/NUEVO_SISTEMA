export const up = (pgm) => {
  pgm.addColumn('empresas', {
    plazo_override_hasta: { type: 'timestamptz', notNull: false, default: null },
  });
};

export const down = (pgm) => {
  pgm.dropColumn('empresas', 'plazo_override_hasta');
};
