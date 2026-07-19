import * as repo from './semanas.repository.js';
import { ApiError } from '../../utils/ApiError.js';

// Normaliza Date o string a 'YYYY-MM-DD'. Rechaza formatos invalidos.
function aISO(fecha) {
  if (fecha instanceof Date) {
    const y = fecha.getFullYear();
    const m = String(fecha.getMonth() + 1).padStart(2, '0');
    const d = String(fecha.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  const s = String(fecha).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw ApiError.badRequest(`Fecha invalida: ${fecha}`);
  return s;
}

function sumarDias(iso, dias) {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + dias);
  return aISO(d);
}

// Fuente unica del calculo del lunes. Consolida las tres copias historicas
// (`pedidos.service.js::lunesDeSemana`, `cocina.repository.js::lunesDe`,
// `pedidos.service.js::validarSemanaInicioLunes`), que migran a este helper en
// fases posteriores del plan semana-raiz. Acepta cualquier fecha de la semana y
// devuelve el lunes en 'YYYY-MM-DD'.
export const lunesDe = (fecha) => {
  const iso = aISO(fecha);
  const d = new Date(`${iso}T00:00:00`);
  const dow = d.getDay(); // 0=domingo .. 6=sabado
  d.setDate(d.getDate() + (dow === 0 ? -6 : 1 - dow));
  return aISO(d);
};

// getOrCreate idempotente por semana. Acepta cualquier fecha de la semana: la
// normaliza al lunes y calcula fecha_fin = lunes + 6. `db` opcional para correr
// dentro de una transaccion.
export const getOrCreateSemana = async (fecha, db) => {
  const lunes = lunesDe(fecha);
  const fechaFin = sumarDias(lunes, 6);
  return repo.getOrCreateByLunes(lunes, fechaFin, db);
};

export const getAllSemanas = () => repo.findAll();

export const getSemanaById = async (id) => {
  const semana = await repo.findById(id);
  if (!semana) throw ApiError.notFound(`Semana con id ${id} no encontrada`);
  return semana;
};

// La semana que contiene hoy. La crea si todavia no existe (idempotente).
export const getSemanaActual = async () => getOrCreateSemana(new Date());
