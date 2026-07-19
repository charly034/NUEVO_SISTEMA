import * as repo from './configuracion.repository.js';

const CLAVE_COLORES = 'menu_resumen_colores';

// Default: paleta "Sobrio" (verde de marca / índigo / naranja). "ninguno" gris.
// categoriaEstilo: cómo se pintan las etiquetas de categoría (sobrio | solido | contorno).
// categorias: color por categoría (clave = slug); si falta, se usa un default por slug.
export const COLORES_DEFAULT = Object.freeze({
  vianda: '#2b7330',
  porKilo: '#6366f1',
  ambos: '#f97316',
  ninguno: '#9ca3af',
  categoriaEstilo: 'sobrio',
  categorias: {},
});

export const getMenuColores = async () => {
  try {
    const valor = await repo.findByClave(CLAVE_COLORES);
    return { ...COLORES_DEFAULT, ...(valor || {}) };
  } catch {
    // Si la tabla configuracion aún no existe (migración pendiente), no romper
    // la página: devolver los defaults.
    return { ...COLORES_DEFAULT };
  }
};

export const setMenuColores = async (colores) => {
  const valor = await repo.upsert(CLAVE_COLORES, colores);
  return { ...COLORES_DEFAULT, ...valor };
};
