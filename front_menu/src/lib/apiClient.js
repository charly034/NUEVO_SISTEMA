import axios from 'axios';

const TOKEN_KEY = 'admin_token';

function getToken() {
  return localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY) || null;
}

const apiClient = axios.create({
  baseURL: '/api/v1',
  headers: { 'Content-Type': 'application/json' },
  timeout: 10000,
});

apiClient.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

apiClient.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const status = error.response?.status;
    const message = error.response?.data?.message || error.message || 'Error inesperado';
    const normalized = new Error(message);
    normalized.status = status;
    normalized.data = error.response?.data;
    if (status === 401) {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem('admin_user');
      sessionStorage.removeItem(TOKEN_KEY);
      sessionStorage.removeItem('admin_user');
      window.dispatchEvent(new Event('admin:unauthorized'));
    }
    return Promise.reject(normalized);
  }
);

export default apiClient;
