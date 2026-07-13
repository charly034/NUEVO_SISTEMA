import { z } from 'zod';

const DIAS = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'];

const idParam = z.string().regex(/^\d+$/, 'El id debe ser un número entero positivo');
const idBody = z.number().int().positive();

export const idParamsSchema = z.object({ id: idParam });

export const cicloParamsSchema = z.object({ cicloId: idParam });

export const grupoParamsSchema = z.object({ grupoId: idParam });

export const grupoPlatoParamsSchema = z.object({ grupoId: idParam, platoId: idParam });

export const cicloQuerySchema = z.object({
  dia_semana: z.enum(DIAS).optional(),
  activo: z.enum(['true', 'false']).optional(),
}).optional();

export const crearCicloSchema = z.object({
  dia_semana: z.enum(DIAS, { required_error: 'dia_semana es obligatorio' }),
  nombre: z.string().min(1, 'nombre es obligatorio').max(140),
});

export const actualizarCicloSchema = z.object({
  nombre: z.string().min(1).max(140).optional(),
  activo: z.boolean().optional(),
}).refine((d) => Object.keys(d).length > 0, {
  message: 'Debe enviar al menos un campo para actualizar',
});

export const crearGrupoSchema = z.object({
  ciclo_rotacion_id: idBody,
  nombre: z.string().min(1, 'nombre es obligatorio').max(140),
  orden: z.number().int().min(0),
});

export const actualizarGrupoSchema = z.object({
  nombre: z.string().min(1).max(140).optional(),
  orden: z.number().int().min(0).optional(),
  activo: z.boolean().optional(),
}).refine((d) => Object.keys(d).length > 0, {
  message: 'Debe enviar al menos un campo para actualizar',
});

export const platoDeGrupoSchema = z.object({
  plato_id: idBody,
  orden: z.number().int().min(0).optional().default(0),
});

export const forzarSeleccionSemanaSchema = z.object({
  menu_semanal_id: idBody,
  ciclo_rotacion_id: idBody,
  grupo_rotativo_id: idBody,
  plato_id: idBody.optional(),
});

export const seleccionSemanaQuerySchema = z.object({
  menu_semanal_id: z.string().regex(/^\d+$/),
});
