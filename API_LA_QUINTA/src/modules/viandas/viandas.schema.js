import { z } from 'zod';

const parseIntOrNull = (value) => {
  if (value === undefined) return undefined;
  if (value === '' || value === null) return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : value;
};

const parseBoolean = (value) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return value === 'true' || value === '1';
  return value;
};

const idNullableSchema = z.preprocess(parseIntOrNull, z.number().int().positive().nullable().optional());
const booleanSchema = z.preprocess(parseBoolean, z.boolean());

export const createViandaSchema = z.object({
  plato_id:       z.preprocess(parseIntOrNull, z.number({ required_error: 'El plato es obligatorio' }).int().positive()),
  guarnicion_id:  idNullableSchema,
  salsa_id:       idNullableSchema,
  salsa_libre:    booleanSchema.optional().default(false),
  empresa_id:     idNullableSchema,
  nombre_vianda:  z.string().max(200).nullable().optional(),
}).refine((d) => !(d.salsa_id && d.salsa_libre), {
  message: 'No podés fijar una salsa y marcar "salsa libre" al mismo tiempo',
  path: ['salsa_libre'],
});

export const updateViandaSchema = z.object({
  plato_id:       z.preprocess(parseIntOrNull, z.number().int().positive().optional()),
  guarnicion_id:  idNullableSchema,
  salsa_id:       idNullableSchema,
  salsa_libre:    booleanSchema.optional(),
  empresa_id:     idNullableSchema,
  nombre_vianda:  z.string().max(200).nullable().optional(),
  activo:         booleanSchema.optional(),
}).refine((d) => Object.keys(d).length > 0, {
  message: 'Debe enviar al menos un campo para actualizar',
}).refine((d) => !(d.salsa_id && d.salsa_libre), {
  message: 'No podés fijar una salsa y marcar "salsa libre" al mismo tiempo',
  path: ['salsa_libre'],
});

export const viandaParamsSchema = z.object({
  id: z.string().regex(/^\d+$/, 'El id debe ser un número entero positivo'),
});

export const viandasQuerySchema = z.object({
  activo:     z.enum(['true', 'false']).optional(),
  empresa_id: z.string().regex(/^\d+$/).optional(),
  plato_id:   z.string().regex(/^\d+$/).optional(),
}).optional();
