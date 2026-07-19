import { z } from 'zod';

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Color hex inválido (formato #rrggbb)');

// Colores de las 4 celdas con estado del resumen semanal (vianda/porKilo/ambos/
// ninguno) + estilo y color por categoría de las etiquetas de la grilla.
export const coloresCeldaSchema = z
  .object({
    vianda: hex,
    porKilo: hex,
    ambos: hex,
    ninguno: hex,
    categoriaEstilo: z.enum(['sobrio', 'solido', 'contorno']).optional(),
    categorias: z.record(hex).optional(),
  })
  .strict();
