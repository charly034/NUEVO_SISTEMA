export const up = (pgm) => {
  pgm.addColumns('empresas', {
    email: {
      type: 'varchar(254)',
      notNull: false,
    },
    telefono: {
      type: 'varchar(30)',
      notNull: false,
    },
  });
};

export const down = (pgm) => {
  pgm.dropColumns('empresas', ['email', 'telefono']);
};
