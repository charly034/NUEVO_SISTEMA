export const up = (pgm) => {
  pgm.addColumn('guarniciones', {
    tipo: {
      type: 'varchar(10)',
      check: "tipo IN ('caliente', 'fria')",
      default: null,
    },
  });
};

export const down = (pgm) => {
  pgm.dropColumn('guarniciones', 'tipo');
};
