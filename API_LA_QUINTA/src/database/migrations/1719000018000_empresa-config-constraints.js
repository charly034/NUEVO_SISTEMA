export const up = (pgm) => {
  pgm.addConstraint(
    'empresas',
    'empresas_dias_laborales_check',
    "CHECK (dias_laborales IN ('lunes_viernes', 'lunes_sabado', 'lunes_domingo'))"
  );
  pgm.addConstraint(
    'empresas',
    'empresas_limite_anticipacion_check',
    'CHECK (limite_anticipacion_dias IN (0, 1))'
  );
};

export const down = (pgm) => {
  pgm.dropConstraint('empresas', 'empresas_limite_anticipacion_check');
  pgm.dropConstraint('empresas', 'empresas_dias_laborales_check');
};
