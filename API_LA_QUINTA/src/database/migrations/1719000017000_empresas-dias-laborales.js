export const up = (pgm) => {
  pgm.addColumn('empresas', {
    dias_laborales: { type: 'varchar(20)', notNull: true, default: 'lunes_viernes' },
  });
};

export const down = (pgm) => {
  pgm.dropColumn('empresas', 'dias_laborales');
};
