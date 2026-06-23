import apiClient from './lib/apiClient.js';

const TOKEN_KEY = 'admin_token';
const USER_KEY  = 'admin_user';

function getToken() {
  return localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY) || null;
}

function saveToken(token, remember) {
  if (remember) {
    localStorage.setItem(TOKEN_KEY, token);
    sessionStorage.removeItem(TOKEN_KEY);
  } else {
    sessionStorage.setItem(TOKEN_KEY, token);
    localStorage.removeItem(TOKEN_KEY);
  }
}

function saveUser(user, remember) {
  const json = JSON.stringify(user);
  if (remember) {
    localStorage.setItem(USER_KEY, json);
    sessionStorage.removeItem(USER_KEY);
  } else {
    sessionStorage.setItem(USER_KEY, json);
    localStorage.removeItem(USER_KEY);
  }
}

function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(USER_KEY);
}

export const adminAuth = {
  login: async (email, password, remember = false) => {
    // El interceptor ya desenvuelve response.data → obtenemos { success, data, message }
    const res = await apiClient.post('/admin/auth/login', { email, password });
    const { token, usuario } = res.data;
    saveToken(token, remember);
    saveUser(usuario, remember);
    return usuario;
  },

  me: async () => {
    const res = await apiClient.get('/admin/auth/me');
    const usuario = res.data;
    const inLocal = !!localStorage.getItem(TOKEN_KEY);
    saveUser(usuario, inLocal);
    return usuario;
  },

  logout: () => clearSession(),

  storedUser: () => {
    try {
      const json = localStorage.getItem(USER_KEY) || sessionStorage.getItem(USER_KEY);
      return json ? JSON.parse(json) : null;
    } catch {
      return null;
    }
  },

  hasToken: () => !!getToken(),
};

export { getToken as getAdminToken };
