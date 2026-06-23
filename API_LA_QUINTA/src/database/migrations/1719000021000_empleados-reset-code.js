export const up = (pgm) => {
  pgm.addColumn('empleados', {
    reset_code:            { type: 'varchar(12)' },
    reset_code_expires_at: { type: 'timestamptz' },
  });
};

export const down = (pgm) => {
  pgm.dropColumn('empleados', 'reset_code_expires_at');
  pgm.dropColumn('empleados', 'reset_code');
};
