export const up = (pgm) => {
  // 'listo' y 'entregado' fueron estados validos de pedido en versiones anteriores.
  // El modelo actual usa 'completo' para indicar que todas las viandas fueron entregadas.
  // Este backfill normaliza pedidos historicos para que sean manejables via la API.
  pgm.sql(`
    UPDATE pedidos
    SET estado = 'completo'::pedido_estado
    WHERE estado IN ('listo', 'entregado')
  `);
};

export const down = () => {
  // No revertimos: 'completo' es semanticamente equivalente y los estados legacy
  // ya no son aceptados por la API. Revertir requeriria conocer el estado original
  // de cada fila, que no se preserva.
};
