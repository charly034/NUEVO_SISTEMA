import apiClient from '../lib/apiClient.js';

function toFormData(data) {
  const form = new FormData();
  Object.entries(data).forEach(([key, value]) => {
    if (value === undefined) return;
    if (key === 'foto') {
      if (value) form.append('foto', value);
      return;
    }
    if (Array.isArray(value)) {
      form.append(key, JSON.stringify(value));
      return;
    }
    if (value === null) {
      form.append(key, '');
      return;
    }
    form.append(key, value);
  });
  return form;
}

function payload(data) {
  return data?.foto ? toFormData(data) : data;
}

export const platosService = {
  getAll: (params) => apiClient.get('/platos', { params }),
  getById: (id) => apiClient.get(`/platos/${id}`),
  getTags: () => apiClient.get('/platos/tags'),
  create: (data) => apiClient.post('/platos', payload(data)),
  update: (id, data) => apiClient.put(`/platos/${id}`, payload(data)),
  remove: (id) => apiClient.delete(`/platos/${id}`),
};
