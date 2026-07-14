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

// ── Excepción de guarnición/salsa por empresa sobre una celda (T8) ────────────
//
// Invariante clave (cierra el agujero que abría la resolución atómica): si el modo
// es 'fija', el id es OBLIGATORIO; si es 'libre'/'sin_*', el id debe ir NULL. Sin
// esto, un override "fija sin id" resolvería a una guarnición nula. Guarnición y
// salsa se validan por SEPARADO: se puede pisar solo una de las dos.
export const empresaIdParamsSchema = z.object({
  id: z.string().regex(/^\d+$/, 'El id de la celda debe ser un número entero positivo'),
  empresaId: z.string().regex(/^\d+$/, 'El id de la empresa debe ser un número entero positivo'),
});

const coherenteFija = (modo, id, campo, ctx) => {
  if (modo === 'fija' && (id === null || id === undefined)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: [`${campo}_fija_override_id`], message: `Si el modo de ${campo} es "fija", hay que elegir cuál` });
  }
  if (modo && modo !== 'fija' && id != null) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: [`${campo}_fija_override_id`], message: `El modo "${modo}" no lleva ${campo} fija` });
  }
};

export const excepcionEmpresaSchema = z.object({
  guarnicion_modo_override: z.enum(['sin_guarnicion', 'libre', 'fija']).nullable().optional(),
  guarnicion_fija_override_id: z.number().int().positive().nullable().optional(),
  salsa_modo_override: z.enum(['sin_salsa', 'libre', 'fija']).nullable().optional(),
  salsa_fija_override_id: z.number().int().positive().nullable().optional(),
}).superRefine((data, ctx) => {
  coherenteFija(data.guarnicion_modo_override, data.guarnicion_fija_override_id, 'guarnicion', ctx);
  coherenteFija(data.salsa_modo_override, data.salsa_fija_override_id, 'salsa', ctx);
  // Una excepción que no pisa nada es una fila muerta: se borra, no se crea.
  if (!data.guarnicion_modo_override && !data.salsa_modo_override) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'La excepción tiene que pisar la guarnición, la salsa, o ambas' });
  }
});
