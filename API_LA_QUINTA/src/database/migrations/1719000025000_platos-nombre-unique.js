export const up = (pgm) => {
  pgm.addConstraint('platos', 'platos_nombre_unique', 'UNIQUE (nombre)');
};

export const down = (pgm) => {
  pgm.dropConstraint('platos', 'platos_nombre_unique');
};
