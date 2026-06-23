export const up = (pgm) => {
  pgm.addColumn('empleados', {
    rol: {
      type: 'varchar(20)',
      notNull: true,
      default: 'cliente',
    },
  });

  pgm.addConstraint(
    'empleados',
    'empleados_rol_check',
    "CHECK (rol IN ('cliente', 'admin'))"
  );
  pgm.createIndex('empleados', 'rol');
};

export const down = (pgm) => {
  pgm.dropConstraint('empleados', 'empleados_rol_check');
  pgm.dropColumn('empleados', 'rol');
};
