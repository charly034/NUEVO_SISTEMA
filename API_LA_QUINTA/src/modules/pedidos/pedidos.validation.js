import { ApiError } from '../../utils/ApiError.js';

export const DIAS_PEDIDO = [
  'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo',
];

export function validarPedidoInput({ semana_inicio, menu_semanal_id, items }) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(semana_inicio || '')) {
    throw ApiError.badRequest('semana_inicio es requerido en formato YYYY-MM-DD');
  }
  if (!Number.isInteger(Number(menu_semanal_id)) || Number(menu_semanal_id) <= 0) {
    throw ApiError.badRequest('menu_semanal_id es requerido');
  }
  if (!Array.isArray(items) || items.length === 0) {
    throw ApiError.badRequest('items es requerido y debe tener al menos un día');
  }
  if (items.length > DIAS_PEDIDO.length) {
    throw ApiError.badRequest('Hay demasiados días en el pedido');
  }

  const diasUnicos = new Set();
  for (const item of items) {
    if (!DIAS_PEDIDO.includes(item.dia)) throw ApiError.badRequest(`Día inválido: ${item.dia}`);
    if (diasUnicos.has(item.dia)) throw ApiError.badRequest(`El día ${item.dia} está repetido`);
    diasUnicos.add(item.dia);
    if (!Number.isInteger(Number(item.plato_id)) || Number(item.plato_id) <= 0) {
      throw ApiError.badRequest(`plato_id inválido en día ${item.dia}`);
    }
    if (item.notas && String(item.notas).length > 300) {
      throw ApiError.badRequest(`Las notas del ${item.dia} superan los 300 caracteres`);
    }
    if (item.opcion && !/^[A-Z]$/.test(item.opcion)) {
      throw ApiError.badRequest(`Opción inválida en día ${item.dia}`);
    }
  }

  return diasUnicos;
}
