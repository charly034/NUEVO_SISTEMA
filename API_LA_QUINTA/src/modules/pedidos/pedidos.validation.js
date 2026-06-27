import { ApiError } from '../../utils/ApiError.js';

export const DIAS_PEDIDO = [
  'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo',
];

export function validarPedidoInput({ semana_inicio, menu_semanal_id, items }) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(semana_inicio || '')) {
    throw ApiError.badRequest('semana_inicio es requerido en formato YYYY-MM-DD');
  }

  if (
    menu_semanal_id !== null &&
    menu_semanal_id !== undefined &&
    (!Number.isInteger(Number(menu_semanal_id)) || Number(menu_semanal_id) <= 0)
  ) {
    throw ApiError.badRequest('menu_semanal_id invalido');
  }

  if (!Array.isArray(items) || items.length === 0) {
    throw ApiError.badRequest('items es requerido y debe tener al menos un dia');
  }

  if (items.length > DIAS_PEDIDO.length) {
    throw ApiError.badRequest('Hay demasiados dias en el pedido');
  }

  const diasUnicos = new Set();
  for (const item of items) {
    if (!DIAS_PEDIDO.includes(item.dia)) throw ApiError.badRequest(`Dia invalido: ${item.dia}`);
    if (diasUnicos.has(item.dia)) throw ApiError.badRequest(`El dia ${item.dia} esta repetido`);
    diasUnicos.add(item.dia);

    if (item.sin_pedido === true) {
      if (item.plato_id !== null && item.plato_id !== undefined) {
        throw ApiError.unprocessable(`Si el ${item.dia} esta marcado sin pedido no debe enviar plato`);
      }
      if (item.guarnicion_id !== null && item.guarnicion_id !== undefined) {
        throw ApiError.unprocessable(`Si el ${item.dia} esta marcado sin pedido no debe enviar guarnicion`);
      }
      if (item.origen && !['usuario', 'default'].includes(item.origen)) {
        throw ApiError.badRequest(`Origen invalido en dia ${item.dia}`);
      }
      continue;
    }

    if (!Number.isInteger(Number(item.plato_id)) || Number(item.plato_id) <= 0) {
      throw ApiError.badRequest(`plato_id invalido en dia ${item.dia}`);
    }
    if (item.notas && String(item.notas).length > 300) {
      throw ApiError.badRequest(`Las notas del ${item.dia} superan los 300 caracteres`);
    }
    if (item.opcion && !/^[A-Z]$/.test(item.opcion)) {
      throw ApiError.badRequest(`Opcion invalida en dia ${item.dia}`);
    }
  }

  return diasUnicos;
}
