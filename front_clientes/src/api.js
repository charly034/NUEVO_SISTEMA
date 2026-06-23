import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api/v1',
  headers: { 'Content-Type': 'application/json' },
  timeout: 10000,
});

api.interceptors.request.use((config) => {
  const token = sessionStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      sessionStorage.removeItem('token');
      sessionStorage.removeItem('empleado');
      window.dispatchEvent(new Event('cliente:unauthorized'));
    }
    const normalized = new Error(
      error.response?.data?.message || error.message || 'Error inesperado'
    );
    normalized.status = error.response?.status;
    normalized.data = error.response?.data;
    return Promise.reject(normalized);
  }
);

const unwrap = (r) => r.data.data;

export const authApi = {
  login: (email, password) => api.post('/auth/login', { email, password }).then(unwrap),
  me: () => api.get('/auth/me').then(unwrap),
};

export const menuApi = {
  hoy: () => api.get('/pedidos/menu-hoy').then(unwrap),
  semana: (fecha_inicio) => api.get('/pedidos/menu-semana', { params: { fecha_inicio } }).then(unwrap),
  activo: () => api.get('/pedidos/menu-activo').then(unwrap),
};

export const pedidoApi = {
  miPedido: (semana_inicio) => api.get('/pedidos/mi-pedido', { params: { semana_inicio } }).then(unwrap),
  guardar: (data) => api.post('/pedidos', data).then(unwrap),
  cancelar: (semana_inicio) => api.delete('/pedidos/mi-pedido', { params: { semana_inicio } }).then(unwrap),
  miHistorial: () => api.get('/pedidos/mi-historial').then(unwrap),
};

export const guarnicionesApi = {
  listar: () => api.get('/guarniciones', { params: { activo: 'true' } }).then(unwrap),
};
