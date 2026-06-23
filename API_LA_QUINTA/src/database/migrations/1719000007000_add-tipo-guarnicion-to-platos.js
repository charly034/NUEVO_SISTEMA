export const up = (pgm) => {
  pgm.addColumn('platos', {
    tipo: {
      type: 'varchar(20)',
      notNull: true,
      default: 'variable',
    },
    tiene_guarnicion: {
      type: 'boolean',
      notNull: true,
      default: false,
    },
  });
  pgm.createIndex('platos', 'tipo');
};

export const down = (pgm) => {
  pgm.dropColumn('platos', 'tipo');
  pgm.dropColumn('platos', 'tiene_guarnicion');
};
