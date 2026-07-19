import { z } from 'zod';

export const semanaParamsSchema = z.object({
  id: z.string().regex(/^\d+$/, 'El id debe ser un numero entero positivo'),
});
