export const up = (pgm) => {
  pgm.sql("ALTER TYPE pedido_item_estado ADD VALUE IF NOT EXISTS 'preparado'");
};

export const down = () => {
  // PostgreSQL no permite quitar un valor de enum de forma segura sin recrear el tipo.
};
