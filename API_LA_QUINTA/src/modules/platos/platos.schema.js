import { z } from 'zod';

const parseArray = (value) => {
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (!trimmed) return [];
  try {
    const parsed = JSON.parse(trimmed);
    return Array.isArray(parsed) ? parsed : value;
  } catch {
    return trimmed.split(',').map((item) => item.trim()).filter(Boolean);
  }
};

const parseBoolean = (value) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return value === 'true' || value === '1';
  return value;
};

const parseIntegerOrNull = (value) => {
  if (value === '' || value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : value;
};

const tagsSchema = z.preprocess(
  parseArray,
  z.array(z.string().min(1).max(50)).max(10).optional().default([]),
);
const alergenosSchema = z.preprocess(
  parseArray,
  z.array(z.string().min(1).max(80)).max(20).optional().default([]),
);
const booleanSchema = z.preprocess(parseBoolean, z.boolean());
const caloriasSchema = z.preprocess(
  parseIntegerOrNull,
  z.number().int().min(0).max(3000).nullable().optional(),
);
const tipoSchema = z.enum(['fijo', 'especial', 'ambos'], {
  errorMap: () => ({ message: "El tipo debe ser 'fijo', 'especial' o 'ambos'" }),
});

export const createPlatoSchema = z.object({
  nombre:           z.string({ required_error: 'El nombre es obligatorio' }).min(2).max(150),
  descripcion:      z.string().max(1000).optional(),
  descripcion_larga:z.string().max(4000).nullable().optional(),
  tags:             tagsSchema,
  alergenos:        alergenosSchema,
  calorias:         caloriasSchema,
  vegetariano:      booleanSchema.optional().default(false),
  foto_url:         z.string().max(1000).nullable().optional(),
  tipo:             tipoSchema.optional().default('especial'),
  tiene_guarnicion: booleanSchema.optional().default(false),
});

export const updatePlatoSchema = z.object({
  nombre:           z.string().min(2).max(150).optional(),
  descripcion:      z.string().max(1000).nullable().optional(),
  descripcion_larga:z.string().max(4000).nullable().optional(),
  activo:           booleanSchema.optional(),
  tags:             z.preprocess(parseArray, z.array(z.string().min(1).max(50)).max(10).nullable().optional()),
  alergenos:        z.preprocess(parseArray, z.array(z.string().min(1).max(80)).max(20).nullable().optional()),
  calorias:         caloriasSchema,
  vegetariano:      booleanSchema.optional(),
  foto_url:         z.string().max(1000).nullable().optional(),
  tipo:             tipoSchema.optional(),
  tiene_guarnicion: booleanSchema.optional(),
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
  tipo:     z.enum(['fijo', 'especial', 'ambos']).optional(),
  sort_by:  z.enum(['nombre', 'activo', 'created_at', 'ultimo_uso']).optional().default('nombre'),
  sort_dir: z.enum(['asc', 'desc']).optional().default('asc'),
}).optional();
