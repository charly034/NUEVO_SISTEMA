import { z } from 'zod';

export const createUserSchema = z.object({
  nombre: z.string({ required_error: 'El nombre es obligatorio' }).min(2, 'El nombre debe tener al menos 2 caracteres').max(100),
  email: z.string({ required_error: 'El email es obligatorio' }).email('El email no es válido').max(255),
});

export const updateUserSchema = z.object({
  nombre: z.string().min(2).max(100).optional(),
  email: z.string().email('El email no es válido').max(255).optional(),
}).refine((data) => Object.keys(data).length > 0, {
  message: 'Debe enviar al menos un campo para actualizar',
});

export const userParamsSchema = z.object({
  id: z.string({ required_error: 'El id es obligatorio' }).regex(/^\d+$/, 'El id debe ser un número entero positivo'),
});

export const getUsersQuerySchema = z.object({
  page: z.string().regex(/^\d+$/).optional().default('1'),
  limit: z.string().regex(/^\d+$/).optional().default('10'),
}).optional();
