import apiClient from '../lib/apiClient.js';

export const platosService = {
  getAll: (params) => apiClient.get('/platos', { params }),
  getById: (id) => apiClient.get(`/platos/${id}`),
  getTags: () => apiClient.get('/platos/tags'),
  create: (data) => apiClient.post('/platos', data),
  update: (id, data) => apiClient.put(`/platos/${id}`, data),
  remove: (id) => apiClient.delete(`/platos/${id}`),
};
