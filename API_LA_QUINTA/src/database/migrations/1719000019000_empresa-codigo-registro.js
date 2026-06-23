export const up = (pgm) => {
  // Código de registro en empresas
  pgm.addColumn('empresas', {
    codigo_registro: { type: 'varchar(10)', unique: true },
  });

  // Datos extra en empleados para autoregistro
  pgm.addColumn('empleados', {
    telefono:        { type: 'varchar(30)' },
    fecha_nacimiento:{ type: 'date' },
  });
};

export const down = (pgm) => {
  pgm.dropColumn('empleados', 'fecha_nacimiento');
  pgm.dropColumn('empleados', 'telefono');
  pgm.dropColumn('empresas', 'codigo_registro');
};
