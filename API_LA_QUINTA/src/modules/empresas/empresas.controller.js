import * as repo from './empresas.repository.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { sendSuccess, sendCreated, sendNoContent } from '../../utils/response.js';
import { ApiError } from '../../utils/ApiError.js';

const PLANES = ['basico', 'con_postre', 'con_postre_bebida'];
const MODOS = ['semanal', 'diario', 'ambos'];
const DIAS_LABORALES = ['lunes_viernes', 'lunes_sabado', 'lunes_domingo'];
const DIAS = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'];

function validarEmpresa(fields) {
  if (fields.plan && !PLANES.includes(fields.plan)) throw ApiError.badRequest('plan inválido');
  if (fields.modo_pedido && !MODOS.includes(fields.modo_pedido)) throw ApiError.badRequest('modo_pedido inválido');
  if (fields.dias_laborales && !DIAS_LABORALES.includes(fields.dias_laborales)) {
    throw ApiError.badRequest('dias_laborales inválido');
  }
  if (fields.limite_dia_semana && !DIAS.includes(fields.limite_dia_semana)) {
    throw ApiError.badRequest('limite_dia_semana inválido');
  }
  if (
    fields.limite_anticipacion_dias !== undefined
    && ![0, 1].includes(Number(fields.limite_anticipacion_dias))
  ) {
    throw ApiError.badRequest('limite_anticipacion_dias debe ser 0 o 1');
  }
}

export const getEmpresas = asyncHandler(async (req, res) => {
  sendSuccess(res, await repo.findAll(), 'Empresas obtenidas');
});

export const getEmpresa = asyncHandler(async (req, res) => {
  const e = await repo.findById(req.params.id);
  if (!e) throw ApiError.notFound('Empresa no encontrada');
  sendSuccess(res, e, 'Empresa obtenida');
});

export const createEmpresa = asyncHandler(async (req, res) => {
  const {
    nombre, slug, plan, modo_pedido, dias_laborales,
    limite_hora, limite_dia_semana, limite_anticipacion_dias,
    email, telefono,
  } = req.body;
  if (!nombre?.trim() || !slug?.trim()) throw ApiError.badRequest('nombre y slug son requeridos');
  const fields = {
    nombre: nombre.trim(),
    slug: slug.trim().toLowerCase(),
    plan,
    modo_pedido,
    dias_laborales,
    limite_hora: limite_hora || null,
    limite_dia_semana: limite_dia_semana || null,
    limite_anticipacion_dias: Number(limite_anticipacion_dias ?? 0),
    email: email?.trim() || null,
    telefono: telefono?.trim() || null,
  };
  validarEmpresa(fields);
  const existe = await repo.findBySlug(fields.slug);
  if (existe) throw ApiError.conflict(`Ya existe una empresa con el slug "${slug}"`);
  sendCreated(res, await repo.create(fields), 'Empresa creada');
});

export const updateEmpresa = asyncHandler(async (req, res) => {
  const e = await repo.findById(req.params.id);
  if (!e) throw ApiError.notFound('Empresa no encontrada');
  const allowed = [
    'nombre', 'slug', 'plan', 'modo_pedido', 'activo',
    'limite_hora', 'limite_dia_semana', 'limite_anticipacion_dias', 'dias_laborales',
    'email', 'telefono',
  ];
  const fields = Object.fromEntries(
    Object.entries(req.body).filter(([key]) => allowed.includes(key))
  );
  if (Object.keys(fields).length === 0) throw ApiError.badRequest('No hay campos válidos para actualizar');
  if (typeof fields.nombre === 'string') fields.nombre = fields.nombre.trim();
  if (typeof fields.slug === 'string') {
    fields.slug = fields.slug.trim().toLowerCase();
    const existente = await repo.findBySlug(fields.slug);
    if (existente && Number(existente.id) !== Number(req.params.id)) {
      throw ApiError.conflict(`Ya existe una empresa con el slug "${fields.slug}"`);
    }
  }
  validarEmpresa(fields);
  const updated = await repo.update(req.params.id, fields);
  sendSuccess(res, updated, 'Empresa actualizada');
});

export const deleteEmpresa = asyncHandler(async (req, res) => {
  const e = await repo.findById(req.params.id);
  if (!e) throw ApiError.notFound('Empresa no encontrada');
  await repo.remove(req.params.id);
  sendNoContent(res);
});

// Abre una ventana de pedido temporal para la empresa (bypassea el límite horario)
export const reabrirPlazo = asyncHandler(async (req, res) => {
  const horas = Math.min(Math.max(parseInt(req.body.horas ?? 2, 10), 1), 24);
  const hasta = new Date(Date.now() + horas * 60 * 60 * 1000);
  const e = await repo.setOverride(req.params.id, hasta);
  if (!e) throw ApiError.notFound('Empresa no encontrada');
  sendSuccess(res, e, `Plazo reabierto por ${horas}h (hasta ${hasta.toLocaleTimeString('es-AR')})`);
});

export const cerrarOverride = asyncHandler(async (req, res) => {
  const e = await repo.clearOverride(req.params.id);
  if (!e) throw ApiError.notFound('Empresa no encontrada');
  sendSuccess(res, e, 'Override de plazo eliminado');
});

export const regenerarCodigo = asyncHandler(async (req, res) => {
  const e = await repo.findById(req.params.id);
  if (!e) throw ApiError.notFound('Empresa no encontrada');
  const updated = await repo.regenerarCodigo(req.params.id);
  sendSuccess(res, { codigo_registro: updated.codigo_registro }, 'Código regenerado');
});
