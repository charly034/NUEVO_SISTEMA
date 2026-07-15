import apiClient from '../lib/apiClient.js';

export const menusService = {
  getAll: (params) => apiClient.get('/menus-semanales', { params }),
  getById: (id) => apiClient.get(`/menus-semanales/${id}`),
  create: (data) => apiClient.post('/menus-semanales', data),
  duplicar: (id, data) => apiClient.post(`/menus-semanales/${id}/duplicar`, data),
  update: (id, data) => apiClient.put(`/menus-semanales/${id}`, data),
  remove: (id) => apiClient.delete(`/menus-semanales/${id}`),

  agregarPlato: (menuId, data) => apiClient.post(`/menus-semanales/${menuId}/dias`, data),
  quitarPlato: (menuId, dia, opcion) => apiClient.delete(`/menus-semanales/${menuId}/dias/${dia}/${opcion}`),
  setEmpresasSlot: (menuId, dia, opcion, data) => apiClient.put(`/menus-semanales/${menuId}/dias/${dia}/${opcion}/empresas`, data),
  // Override de guarnición/salsa a nivel CELDA (solo esta semana) -- "pisar esta
  // semana", distinto de editar la vianda (que cambia la base para todas las semanas).
  setGuarnicionSlot: (menuId, dia, opcion, data) => apiClient.patch(`/menus-semanales/${menuId}/dias/${dia}/${opcion}/guarnicion`, data),
  setSalsaSlot: (menuId, dia, opcion, data) => apiClient.patch(`/menus-semanales/${menuId}/dias/${dia}/${opcion}/salsa`, data),

  marcarSinServicio: (menuId, data) => apiClient.post(`/menus-semanales/${menuId}/sin-servicio`, data),
  quitarSinServicio: (menuId, dia) => apiClient.delete(`/menus-semanales/${menuId}/sin-servicio/${dia}`),

  cambiarEstado: (id, estado, extra = {}) => apiClient.patch(`/menus-semanales/${id}/estado`, { estado, ...extra }),

  getHistorialPlato: (platoId) => apiClient.get(`/menus-semanales/historial/plato/${platoId}`),
  getUsados: (params) => apiClient.get('/menus-semanales/historial/usados', { params }),
  getNoUsados: (params) => apiClient.get('/menus-semanales/historial/no-usados', { params }),
};
