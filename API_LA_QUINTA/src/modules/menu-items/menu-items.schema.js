import { z } from 'zod';

const DIAS = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'];

export const idParamsSchema = z.object({
  id: z.string().regex(/^\d+$/, 'El id debe ser un número entero positivo'),
});

// categoria_id null = mover a "Sin categorizar". La clave debe venir presente.
export const reasignarCategoriaSchema = z.object({
  categoria_id: z.number().int().positive().nullable(),
});

// Agregar un plato a una categoría (celda nueva). dia/opcion opcionales según
// el tipo de categoría (lista sin letra -> ambos null; modo único -> dia null).
export const agregarItemSchema = z.object({
  menu_semanal_id: z.number().int().positive(),
  categoria_id: z.number().int().positive(),
  plato_id: z.number().int().positive(),
  dia: z.enum(DIAS).nullable().optional(),
  opcion: z.string().min(1).max(3).nullable().optional(),
});
