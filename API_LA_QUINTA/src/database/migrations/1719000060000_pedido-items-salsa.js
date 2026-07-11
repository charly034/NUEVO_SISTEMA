export const up = (pgm) => {
  pgm.addColumns('pedido_items', {
    salsa_id: {
      type: 'integer',
      references: '"salsas"',
      onDelete: 'SET NULL',
    },
  });
};

export const down = (pgm) => {
  pgm.dropColumns('pedido_items', ['salsa_id']);
};
