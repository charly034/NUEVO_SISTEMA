import * as repo from './empresas.repository.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { sendSuccess, sendCreated } from '../../utils/response.js';
import { ApiError } from '../../utils/ApiError.js';
import * as planesRepo from '../planes/planes.repository.js';
import * as auditoriaService from '../admin-auditoria/admin-auditoria.service.js';

const MODOS = ['semanal', 'diario', 'ambos'];
const DIAS_LABORALES = ['lunes_viernes', 'lunes_sabado', 'lunes_domingo'];
const DIAS = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'];

function validarEmpresa(fields) {
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
  if (
    fields.opcion_default !== undefined
    && fields.opcion_default !== null
    && !/^[A-Z]$/.test(fields.opcion_default)
  ) {
    throw ApiError.badRequest('opcion_default debe ser una letra (A-Z) o null para todas las opciones');
  }
}

async function resolverPlanEmpresa(fields) {
  if (!fields.plan_id) return;
  const plan = await planesRepo.findById(fields.plan_id);
  if (!plan || !plan.activo) throw ApiError.badRequest('plan_id invalido o inactivo');
  fields.plan_id = plan.id;
}

export const getEmpresas = asyncHandler(async (req, res) => {
  const page = Math.max(Number(req.query.page) || 1, 1);
  const pageSize = Math.min(Math.max(Number(req.query.pageSize) || 20, 1), 1000);
  const search = String(req.query.search || '').trim();
  const estado = ['activa', 'inactiva', 'todas'].includes(req.query.estado)
    ? req.query.estado
    : 'todas';
  const [data, total] = await Promise.all([
    repo.findAll({ page, pageSize, search, estado }),
    repo.countAll({ search, estado }),
  ]);
  sendSuccess(res, { data, total, page, pageSize }, 'Empresas obtenidas');
});

export const getEmpresa = asyncHandler(async (req, res) => {
  const e = await repo.findById(req.params.id);
  if (!e) throw ApiError.notFound('Empresa no encontrada');
  sendSuccess(res, e, 'Empresa obtenida');
});

export const getDependenciasEmpresa = asyncHandler(async (req, res) => {
  const e = await repo.findById(req.params.id);
  if (!e) throw ApiError.notFound('Empresa no encontrada');
  sendSuccess(res, await repo.getDependenciasEliminacion(req.params.id), 'Dependencias de empresa obtenidas');
});

export const createEmpresa = asyncHandler(async (req, res) => {
  const {
    nombre, slug, plan_id, modo_pedido, dias_laborales,
    limite_hora, limite_dia_semana, limite_anticipacion_dias,
    email, telefono, opcion_default,
  } = req.body;
  if (!nombre?.trim() || !slug?.trim()) throw ApiError.badRequest('nombre y slug son requeridos');
  const fields = {
    nombre: nombre.trim(),
    slug: slug.trim().toLowerCase(),
    plan_id: plan_id || null,
    modo_pedido,
    dias_laborales,
    limite_hora: limite_hora || null,
    limite_dia_semana: limite_dia_semana || null,
    limite_anticipacion_dias: Number(limite_anticipacion_dias ?? 0),
    email: email?.trim() || null,
    telefono: telefono?.trim() || null,
    opcion_default: opcion_default || null,
  };
  validarEmpresa(fields);
  await resolverPlanEmpresa(fields);
  const existe = await repo.findBySlug(fields.slug);
  if (existe) throw ApiError.conflict(`Ya existe una empresa con el slug "${slug}"`);
  const creada = await repo.create(fields);
  await auditoriaService.registrarAdminAction({
    adminUser: req.adminUser,
    accion: 'crear',
    entidad_tipo: 'empresa',
    entidad_id: creada.id,
    resumen: `Creó la empresa ${creada.nombre}`,
    despues: creada,
  });
  sendCreated(res, creada, 'Empresa creada');
});

export const updateEmpresa = asyncHandler(async (req, res) => {
  const e = await repo.findById(req.params.id);
  if (!e) throw ApiError.notFound('Empresa no encontrada');
  const allowed = [
    'nombre', 'slug', 'plan_id', 'modo_pedido', 'activo',
    'limite_hora', 'limite_dia_semana', 'limite_anticipacion_dias', 'dias_laborales',
    'email', 'telefono', 'opcion_default',
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
  await resolverPlanEmpresa(fields);
  const updated = await repo.update(req.params.id, fields);
  await auditoriaService.registrarAdminAction({
    adminUser: req.adminUser,
    accion: 'actualizar',
    entidad_tipo: 'empresa',
    entidad_id: req.params.id,
    resumen: `Actualizó la empresa ${updated.nombre}`,
    antes: e,
    despues: updated,
  });
  sendSuccess(res, updated, 'Empresa actualizada');
});

export const deleteEmpresa = asyncHandler(async (req, res) => {
  const e = await repo.findById(req.params.id);
  if (!e) throw ApiError.notFound('Empresa no encontrada');
  const dependencias = await repo.getDependenciasEliminacion(req.params.id);
  if (!dependencias.puedeEliminarse) {
    return res.status(409).json({
      success: false,
      message: 'No se puede eliminar',
      data: {
        detalle: {
          pedidosActivos: dependencias.pedidosActivos,
          saldoCuentaCorriente: dependencias.saldoCuentaCorriente,
        },
      },
      errors: [],
    });
  }
  await repo.remove(req.params.id);
  await auditoriaService.registrarAdminAction({
    adminUser: req.adminUser,
    accion: 'eliminar',
    entidad_tipo: 'empresa',
    entidad_id: e.id,
    resumen: `Eliminó (baja lógica) la empresa ${e.nombre}`,
    antes: e,
  });
  sendSuccess(res, { id: e.id, activo: false, deleted_at: new Date().toISOString() }, 'Empresa eliminada');
});

export const reabrirPlazo = asyncHandler(async (req, res) => {
  const horas = Math.min(Math.max(parseInt(req.body.horas ?? 2, 10), 1), 24);
  const hasta = new Date(Date.now() + horas * 60 * 60 * 1000);
  const e = await repo.setOverride(req.params.id, hasta);
  if (!e) throw ApiError.notFound('Empresa no encontrada');
  await auditoriaService.registrarAdminAction({
    adminUser: req.adminUser,
    accion: 'actualizar',
    entidad_tipo: 'empresa',
    entidad_id: e.id,
    resumen: `Reabrió el plazo de pedidos de ${e.nombre} por ${horas}h`,
    despues: { id: e.id, override_hasta: hasta.toISOString() },
  });
  sendSuccess(res, e, `Plazo reabierto por ${horas}h (hasta ${hasta.toLocaleTimeString('es-AR')})`);
});

export const cerrarOverride = asyncHandler(async (req, res) => {
  const e = await repo.clearOverride(req.params.id);
  if (!e) throw ApiError.notFound('Empresa no encontrada');
  await auditoriaService.registrarAdminAction({
    adminUser: req.adminUser,
    accion: 'actualizar',
    entidad_tipo: 'empresa',
    entidad_id: e.id,
    resumen: `Cerró el override de plazo de pedidos de ${e.nombre}`,
    despues: { id: e.id },
  });
  sendSuccess(res, e, 'Override de plazo eliminado');
});

export const regenerarCodigo = asyncHandler(async (req, res) => {
  const e = await repo.findById(req.params.id);
  if (!e) throw ApiError.notFound('Empresa no encontrada');
  const updated = await repo.regenerarCodigo(req.params.id);
  await auditoriaService.registrarAdminAction({
    adminUser: req.adminUser,
    accion: 'actualizar',
    entidad_tipo: 'empresa',
    entidad_id: e.id,
    resumen: `Regeneró el código de registro de ${e.nombre}`,
    despues: { id: e.id },
  });
  sendSuccess(res, { codigo_registro: updated.codigo_registro }, 'Código regenerado');
});
