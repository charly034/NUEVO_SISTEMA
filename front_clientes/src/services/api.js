import axios from 'axios';
import { iniciarMedicionPerformance } from '../utils/performance.js';

const TOKEN_KEY   = 'token';
const EMPLEADO_KEY = 'empleado';

export function getClientToken() {
  return localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY) || null;
}

export function saveClientSession({ token, empleado }, remember) {
  const json = JSON.stringify(empleado);
  if (remember) {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(EMPLEADO_KEY, json);
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(EMPLEADO_KEY);
  } else {
    sessionStorage.setItem(TOKEN_KEY, token);
    sessionStorage.setItem(EMPLEADO_KEY, json);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(EMPLEADO_KEY);
  }
}

export function clearClientSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(EMPLEADO_KEY);
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(EMPLEADO_KEY);
}

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api/v1',
  headers: { 'Content-Type': 'application/json' },
  timeout: 10000,
});

api.interceptors.request.use((config) => {
  const token = getClientToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  config.metadata = {
    ...(config.metadata || {}),
    finalizarMedicion: iniciarMedicionPerformance('request:axios', {
      metodo: String(config.method || 'get').toUpperCase(),
      recurso: String(config.url || '').split('?')[0],
    }),
  };
  return config;
});

api.interceptors.response.use(
  (response) => {
    response.config.metadata?.finalizarMedicion?.({
      estado: 'ok',
      status: response.status,
    });
    return response;
  },
  (error) => {
    error.config?.metadata?.finalizarMedicion?.({
      estado: 'error',
      status: error.response?.status,
    });
    if (error.response?.status === 401) {
      clearClientSession();
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
  login:           (email, password, remember = false) =>
    api.post('/auth/login', { email, password, remember }).then(unwrap),
  me:              () => api.get('/auth/me').then(unwrap),
  verificarCodigo: (codigo) =>
    api.get(`/auth/verificar-codigo/${encodeURIComponent(codigo)}`).then(unwrap),
  registro:        (datos) =>
    api.post('/auth/registro', datos).then(unwrap),
  usarResetCode:   (codigo, password) =>
    api.post('/auth/usar-reset-code', { codigo, password }).then(unwrap),
  cambiarPassword: (password_actual, password_nuevo) =>
    api.post('/auth/cambiar-password', { password_actual, password_nuevo }).then(unwrap),
  actualizarPerfil: (datos) =>
    api.patch('/auth/perfil', datos).then(unwrap),
};

export const menuApi = {
  hoy:    ()             => api.get('/pedidos/menu-hoy').then(unwrap),
  semana: (fecha_inicio) => api.get('/pedidos/menu-semana', { params: { fecha_inicio } }).then(unwrap),
  activo: ()             => api.get('/pedidos/menu-activo').then(unwrap),
};

export const pedidoApi = {
  miPedido:   (semana_inicio) => api.get('/pedidos/mi-pedido', { params: { semana_inicio } }).then(unwrap),
  guardar:    (data)          => api.post('/pedidos', data).then(unwrap),
  cancelar:   (semana_inicio) => api.delete('/pedidos/mi-pedido', { params: { semana_inicio } }).then(unwrap),
  miHistorial: ()             => api.get('/pedidos/mi-historial').then(unwrap),
};

export const guarnicionesApi = {
  listar: () => api.get('/guarniciones', { params: { activo: 'true' } }).then(unwrap),
};
