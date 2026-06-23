import axios from 'axios';

const apiClient = axios.create({
  baseURL: '/api/v1',
  headers: { 'Content-Type': 'application/json' },
  timeout: 10000,
});

apiClient.interceptors.request.use((config) => {
  const token = sessionStorage.getItem('admin_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Desenvuelve la respuesta estándar { success, data, message }
apiClient.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const status = error.response?.status;
    const message =
      error.response?.data?.message ||
      error.message ||
      'Error inesperado';
    const normalized = new Error(message);
    normalized.status = status;
    normalized.data = error.response?.data;
    if (status === 401) {
      sessionStorage.removeItem('admin_token');
      sessionStorage.removeItem('admin_user');
      window.dispatchEvent(new Event('admin:unauthorized'));
    }
    return Promise.reject(normalized);
  }
);

export default apiClient;
