export const up = (pgm) => {
  pgm.addColumns('menus_semanales', {
    created_by_admin_id: {
      type: 'integer',
      references: '"usuarios_admin"(id)',
      onDelete: 'SET NULL',
      notNull: false,
    },
    updated_by_admin_id: {
      type: 'integer',
      references: '"usuarios_admin"(id)',
      onDelete: 'SET NULL',
      notNull: false,
    },
  });
};

export const down = (pgm) => {
  pgm.dropColumns('menus_semanales', ['created_by_admin_id', 'updated_by_admin_id']);
};
