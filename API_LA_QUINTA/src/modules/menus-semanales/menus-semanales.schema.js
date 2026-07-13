import { z } from 'zod';

const DIAS = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'];

// Opción: letra mayúscula A-Z
const opcionSchema = z
  .string()
  .length(1)
  .regex(/^[A-Z]$/, 'La opción debe ser una letra mayúscula (A, B, C...)');

export const createMenuSemanalSchema = z.object({
  nombre: z.string({ required_error: 'El nombre es obligatorio' }).min(2).max(150),
  fecha_inicio: z
    .string({ required_error: 'La fecha de inicio es obligatoria' })
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha inválido, usar YYYY-MM-DD'),
  fecha_fin: z
    .string({ required_error: 'La fecha de fin es obligatoria' })
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha inválido, usar YYYY-MM-DD'),
}).refine((d) => new Date(d.fecha_fin) >= new Date(d.fecha_inicio), {
  message: 'La fecha de fin debe ser igual o posterior a la fecha de inicio',
  path: ['fecha_fin'],
});

export const updateMenuSemanalSchema = z
  .object({
    nombre: z.string().min(2).max(150).optional(),
    fecha_inicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    fecha_fin: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  })
  .refine((d) => Object.keys(d).length > 0, {
    message: 'Debe enviar al menos un campo para actualizar',
  });

export const menuSemanalParamsSchema = z.object({
  id: z.string().regex(/^\d+$/, 'El id debe ser un número entero positivo'),
});

export const duplicarMenuSemanalSchema = z.object({
  nombre: z.string({ required_error: 'El nombre es obligatorio' }).min(2).max(150),
  fecha_inicio: z
    .string({ required_error: 'La fecha de inicio es obligatoria' })
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha inválido, usar YYYY-MM-DD'),
  fecha_fin: z
    .string({ required_error: 'La fecha de fin es obligatoria' })
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha inválido, usar YYYY-MM-DD'),
}).refine((d) => new Date(d.fecha_fin) >= new Date(d.fecha_inicio), {
  message: 'La fecha de fin debe ser igual o posterior a la fecha de inicio',
  path: ['fecha_fin'],
});

export const menusSemanalesQuerySchema = z
  .object({
    page: z.string().regex(/^\d+$/).optional().default('1'),
    limit: z.string().regex(/^\d+$/).optional().default('10'),
    desde: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    hasta: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  })
  .optional();

// Agregar un plato a un día con su opción
export const agregarPlatoDiaSchema = z.object({
  dia: z.enum(DIAS, { required_error: 'El día es obligatorio' }),
  opcion: opcionSchema.default('A'),
  plato_id: z
    .number({ required_error: 'El plato_id es obligatorio' })
    .int()
    .positive(),
  guarnicion_modo_override: z.enum(['sin_guarnicion', 'libre', 'fija']).nullable().optional(),
  guarnicion_fija_override_id: z.number().int().positive().nullable().optional(),
  salsa_modo_override: z.enum(['sin_salsa', 'libre', 'fija']).nullable().optional(),
  salsa_fija_override_id: z.number().int().positive().nullable().optional(),
  allow_duplicate: z.boolean().optional().default(false),
});

// Actualizar empresas visibles para un slot ([] = todas las empresas)
export const setEmpresasSlotSchema = z.object({
  empresa_ids: z.array(z.number().int().positive()).default([]),
});

// Actualizar guarnición de un slot ya existente
export const actualizarGuarnicionSlotSchema = z.object({
  guarnicion_modo_override: z.enum(['sin_guarnicion', 'libre', 'fija']).nullable(),
  guarnicion_fija_override_id: z.number().int().positive().nullable().optional(),
});

// Actualizar salsa de un slot ya existente
export const actualizarSalsaSlotSchema = z.object({
  salsa_modo_override: z.enum(['sin_salsa', 'libre', 'fija']).nullable(),
  salsa_fija_override_id: z.number().int().positive().nullable().optional(),
});

// Params para operar sobre un día + opción específica
export const diaOpcionParamsSchema = z.object({
  id: z.string().regex(/^\d+$/, 'El id de menú debe ser un número'),
  dia: z.enum(DIAS, { errorMap: () => ({ message: `El día debe ser uno de: ${DIAS.join(', ')}` }) }),
  opcion: opcionSchema,
});

// Marcar un día como sin servicio
export const sinServicioSchema = z.object({
  dia: z.enum(DIAS, { required_error: 'El día es obligatorio' }),
  motivo: z.string().max(200).optional(),
});

export const sinServicioParamsSchema = z.object({
  id: z.string().regex(/^\d+$/, 'El id de menú debe ser un número'),
  dia: z.enum(DIAS, { errorMap: () => ({ message: `El día debe ser uno de: ${DIAS.join(', ')}` }) }),
});

// Historial
export const platoIdParamsSchema = z.object({
  platoId: z.string().regex(/^\d+$/, 'El platoId debe ser un número entero positivo'),
});

// Filtros para los endpoints de historial (usados / no usados)
// Se puede usar UNO de estos grupos, en este orden de prioridad:
//   1. desde + hasta  (rango explícito, ambos opcionales)
//   2. dias           (últimos N días)
//   3. mes            (YYYY-MM)
//   4. semana         (YYYY-Www, ISO, ej: 2026-W25)
//   Sin ninguno: devuelve todo el historial
export const historialFiltrosSchema = z
  .object({
    desde: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato YYYY-MM-DD').optional(),
    hasta: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato YYYY-MM-DD').optional(),
    dias:  z.string().regex(/^\d+$/, 'Debe ser un número positivo').optional(),
    mes:   z.string().regex(/^\d{4}-\d{2}$/, 'Formato YYYY-MM').optional(),
    semana: z.string().regex(/^\d{4}-W\d{2}$/, 'Formato YYYY-Www (ej: 2026-W25)').optional(),
  })
  .optional()
  .refine(
    (d) => {
      if (!d) return true;
      // dias, mes y semana no pueden combinarse entre sí (desde/hasta sí pueden ir solos)
      const exclusivos = [d.dias, d.mes, d.semana].filter(Boolean);
      return exclusivos.length <= 1;
    },
    { message: 'Solo podés usar uno de: dias, mes o semana (desde/hasta se pueden combinar con cualquiera)' }
  );
