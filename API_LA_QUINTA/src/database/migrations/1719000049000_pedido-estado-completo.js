export const up = (pgm) => {
  pgm.sql("ALTER TYPE pedido_estado ADD VALUE IF NOT EXISTS 'completo'");
};

export const down = () => {
  // PostgreSQL no permite quitar un valor de enum de forma segura sin recrear el tipo.
};
