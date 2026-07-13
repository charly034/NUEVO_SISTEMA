import { z } from 'zod';

const idParam = z.string().regex(/^\d+$/, 'El id debe ser un número entero positivo');

export const menuParamsSchema = z.object({
  menuSemanalId: idParam,
});

export const empresaOpcionParamsSchema = z.object({
  menuSemanalId: idParam,
  empresaId: idParam,
});

export const slotParamsSchema = z.object({
  slotId: idParam,
});

export const opcionExcepcionSchema = z.object({
  opcion: z.string().regex(/^[A-Z]$/, 'opcion debe ser una letra A-Z'),
});

export const disponiblePorKiloSchema = z.object({
  disponible: z.boolean(),
});

export const fijoViandaParamsSchema = z.object({
  menuSemanalId: idParam,
  platoId: idParam,
});

export const setEmpresasFijoSchema = z.object({
  empresa_ids: z.array(z.number().int().positive()).default([]),
});

export const guarnicionSemanaParamsSchema = z.object({
  menuSemanalId: idParam,
  guarnicionId: idParam,
});

export const salsaSemanaParamsSchema = z.object({
  menuSemanalId: idParam,
  salsaId: idParam,
});
