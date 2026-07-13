import { z } from 'zod';

export const vistaSemanalParamsSchema = z.object({
  menuSemanalId: z.string().regex(/^\d+$/, 'El id debe ser un número entero positivo'),
});
