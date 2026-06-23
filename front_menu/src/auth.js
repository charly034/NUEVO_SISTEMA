import apiClient from './lib/apiClient.js';

export const adminAuth = {
  login: async (email, password) => {
    const response = await apiClient.post('/auth/login', { email, password });
    if (response.data.empleado.rol !== 'admin') {
      throw new Error('Esta cuenta no tiene acceso al panel administrativo');
    }
    sessionStorage.setItem('admin_token', response.data.token);
    sessionStorage.setItem('admin_user', JSON.stringify(response.data.empleado));
    return response.data.empleado;
  },
  me: async () => {
    const response = await apiClient.get('/auth/me');
    if (response.data.rol !== 'admin') {
      throw new Error('Esta cuenta no tiene acceso al panel administrativo');
    }
    sessionStorage.setItem('admin_user', JSON.stringify(response.data));
    return response.data;
  },
  logout: () => {
    sessionStorage.removeItem('admin_token');
    sessionStorage.removeItem('admin_user');
  },
  storedUser: () => {
    try {
      return JSON.parse(sessionStorage.getItem('admin_user'));
    } catch {
      return null;
    }
  },
};
