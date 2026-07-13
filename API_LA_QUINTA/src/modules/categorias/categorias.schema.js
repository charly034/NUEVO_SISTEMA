import { z } from 'zod';

const idParam = z.string().regex(/^\d+$/, 'El id debe ser un número entero positivo');
const idBody = z.number().int().positive();

const MODOS = ['plato_distinto_por_dia', 'plato_unico_todos_los_dias'];
const CRITERIOS = ['siempre', 'pares', 'impares', 'ciclo', 'cada_n', 'rango_fechas', 'semana_mes'];

export const idParamsSchema = z.object({ id: idParam });
export const grupoParamsSchema = z.object({ id: idParam, grupoId: idParam });
export const grupoPlatoParamsSchema = z.object({ id: idParam, grupoId: idParam, platoId: idParam });

export const listQuerySchema = z.object({
  tipo_dato: z.enum(['platos', 'guarniciones', 'salsas']).optional(),
  activo: z.enum(['true', 'false']).optional(),
  incluir_sistema: z.enum(['true', 'false']).optional(),
}).optional();

// Defaults de vianda/kilo/visibilidad (fila opcional categoria_defaults_vianda).
const defaultsSchema = z.object({
  default_vianda_activa: z.boolean().optional(),
  default_disponible_por_kilo: z.boolean().optional(),
  default_empresa_ids: z.array(idBody).nullable().optional(),
}).strict();

// Solo se crean categorias custom de tipo_dato='platos' (van a
// menu_semanal_dias). Guarniciones/Salsas ya tienen sus categorias de sistema
// sobre tablas propias; no se crean custom de esos tipos.
export const crearCategoriaSchema = z.object({
  nombre: z.string().min(1, 'nombre es obligatorio').max(100),
  alcance: z.enum(['semana', 'recurrente']).optional().default('recurrente'),
  menu_semanal_id: idBody.nullable().optional(),
  modo: z.enum(MODOS).optional().default('plato_distinto_por_dia'),
  usa_opcion: z.boolean().optional().default(false),
  orden: z.number().int().min(0).optional().default(0),
  defaults: defaultsSchema.optional(),
}).refine(
  (d) => d.alcance !== 'semana' || (d.menu_semanal_id != null),
  { message: 'Una categoría de alcance "semana" requiere menu_semanal_id', path: ['menu_semanal_id'] },
).refine(
  (d) => d.alcance !== 'recurrente' || (d.menu_semanal_id == null),
  { message: 'Una categoría "recurrente" no puede tener menu_semanal_id', path: ['menu_semanal_id'] },
);

export const actualizarCategoriaSchema = z.object({
  nombre: z.string().min(1).max(100).optional(),
  modo: z.enum(MODOS).optional(),
  usa_opcion: z.boolean().optional(),
  orden: z.number().int().min(0).optional(),
  activo: z.boolean().optional(),
  defaults: defaultsSchema.optional(),
}).refine((d) => Object.keys(d).length > 0, {
  message: 'Debe enviar al menos un campo para actualizar',
});

export const duplicarCategoriaSchema = z.object({
  nombre: z.string().min(1).max(100).optional(),
}).optional();

// ── Grupos de rotación de la categoría ─────────────────────────────────

const fechaOpt = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'fecha debe ser YYYY-MM-DD').nullable().optional();
const paramsGrupo = {
  criterio: z.enum(CRITERIOS).optional(),
  ciclo_offset: z.number().int().min(0).nullable().optional(),
  periodo: z.number().int().min(1).nullable().optional(),
  fecha_desde: fechaOpt,
  fecha_hasta: fechaOpt,
  semana_del_mes: z.number().int().min(1).max(5).nullable().optional(),
  meses: z.array(z.number().int().min(1).max(12)).nullable().optional(),
};

// Requisitos por criterio (se aplican tanto a crear como a actualizar; si
// criterio no viene en un PATCH parcial, no se exige nada nuevo).
function aplicarReglasCriterio(schema) {
  return schema
    .refine((d) => d.criterio !== 'ciclo' || d.ciclo_offset != null, { message: 'criterio "ciclo" requiere ciclo_offset', path: ['ciclo_offset'] })
    .refine((d) => d.criterio !== 'cada_n' || (d.periodo != null && d.periodo >= 1), { message: 'criterio "cada_n" requiere periodo (>= 1)', path: ['periodo'] })
    .refine((d) => d.criterio !== 'rango_fechas' || (d.fecha_desde && d.fecha_hasta), { message: 'criterio "rango_fechas" requiere fecha_desde y fecha_hasta', path: ['fecha_desde'] })
    .refine((d) => d.criterio !== 'semana_mes' || d.semana_del_mes != null, { message: 'criterio "semana_mes" requiere semana_del_mes', path: ['semana_del_mes'] });
}

export const crearGrupoSchema = aplicarReglasCriterio(z.object({
  nombre: z.string().min(1, 'nombre es obligatorio').max(100),
  ...paramsGrupo,
  criterio: z.enum(CRITERIOS).optional().default('siempre'),
  orden: z.number().int().min(0).optional().default(0),
  activo: z.boolean().optional().default(true),
}));

export const actualizarGrupoSchema = aplicarReglasCriterio(z.object({
  nombre: z.string().min(1).max(100).optional(),
  ...paramsGrupo,
  orden: z.number().int().min(0).optional(),
  activo: z.boolean().optional(),
}).refine((d) => Object.keys(d).length > 0, {
  message: 'Debe enviar al menos un campo para actualizar',
}));

export const platoDeGrupoSchema = z.object({
  plato_id: idBody,
  orden: z.number().int().min(0).optional().default(0),
});

export const gruposActivosQuerySchema = z.object({
  fecha_inicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'fecha_inicio debe ser YYYY-MM-DD'),
});

// ── Rotación por semana (materializar / excepción manual) ───────────────
export const resembrarRotacionSchema = z.object({ menu_semanal_id: idBody });
export const forzarGrupoSemanaSchema = z.object({ menu_semanal_id: idBody, grupo_id: idBody });
export const quitarForzadoSemanaSchema = z.object({ menu_semanal_id: idBody });
