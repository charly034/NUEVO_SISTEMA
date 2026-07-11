import { z } from 'zod';

const DIAS = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'];

export const menuIdParamsSchema = z.object({
  menuId: z.string().regex(/^\d+$/, 'menuId debe ser un entero positivo'),
});

export const etiquetasParamsSchema = z.object({
  menuId: z.string().regex(/^\d+$/, 'menuId debe ser un entero positivo'),
  dia: z.enum(DIAS, { errorMap: () => ({ message: `dia debe ser uno de: ${DIAS.join(', ')}` }) }),
});

export const hoyQuerySchema = z.object({
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato YYYY-MM-DD').optional(),
}).optional();
