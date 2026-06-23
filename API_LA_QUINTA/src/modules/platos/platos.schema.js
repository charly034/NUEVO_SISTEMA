import { z } from 'zod';

const tagsSchema = z.array(z.string().min(1).max(50)).max(10).optional().default([]);

export const createPlatoSchema = z.object({
  nombre: z.string({ required_error: 'El nombre es obligatorio' }).min(2).max(150),
  descripcion: z.string().max(1000).optional(),
  tags: tagsSchema,
});

export const updatePlatoSchema = z.object({
  nombre: z.string().min(2).max(150).optional(),
  descripcion: z.string().max(1000).nullable().optional(),
  activo: z.boolean().optional(),
  tags: z.array(z.string().min(1).max(50)).max(10).nullable().optional(),
}).refine((d) => Object.keys(d).length > 0, {
  message: 'Debe enviar al menos un campo para actualizar',
});

export const platoParamsSchema = z.object({
  id: z.string().regex(/^\d+$/, 'El id debe ser un número entero positivo'),
});

export const platosQuerySchema = z.object({
  page:     z.string().regex(/^\d+$/).optional().default('1'),
  limit:    z.string().regex(/^\d+$/).optional().default('20'),
  activo:   z.enum(['true', 'false']).optional(),
  search:   z.string().max(100).optional(),
  tag:      z.string().max(50).optional(),
  sort_by:  z.enum(['nombre', 'activo', 'created_at', 'ultimo_uso']).optional().default('nombre'),
  sort_dir: z.enum(['asc', 'desc']).optional().default('asc'),
}).optional();
