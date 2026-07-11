import apiClient from '../lib/apiClient.js';

export const cocinaService = {
  getHoy: (fecha) => apiClient.get('/cocina/hoy', { params: fecha ? { fecha } : undefined }),
  getSemana: (menuId) => apiClient.get(`/cocina/semana/${menuId}`),
  getOferta: (menuId) => apiClient.get(`/cocina/oferta/${menuId}`),
  getEtiquetas: (menuId, dia) => apiClient.get(`/cocina/etiquetas/${menuId}/${dia}`),
};
