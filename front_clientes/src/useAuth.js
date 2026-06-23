import { useState, useCallback, useEffect } from 'react';
import { authApi } from './api.js';

export function useAuth() {
  const [empleado, setEmpleado] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem('empleado')); } catch { return null; }
  });
  const [checking, setChecking] = useState(() => !!sessionStorage.getItem('token'));

  const logout = useCallback(() => {
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('empleado');
    localStorage.removeItem('token');
    localStorage.removeItem('empleado');
    setEmpleado(null);
  }, []);

  useEffect(() => {
    const unauthorized = () => logout();
    window.addEventListener('cliente:unauthorized', unauthorized);
    return () => window.removeEventListener('cliente:unauthorized', unauthorized);
  }, [logout]);

  useEffect(() => {
    if (!sessionStorage.getItem('token')) return;
    authApi.me()
      .then((data) => {
        sessionStorage.setItem('empleado', JSON.stringify(data));
        setEmpleado(data);
      })
      .catch(logout)
      .finally(() => setChecking(false));
  }, [logout]);

  const login = useCallback(async (email, password) => {
    const data = await authApi.login(email, password);
    sessionStorage.setItem('token', data.token);
    sessionStorage.setItem('empleado', JSON.stringify(data.empleado));
    setEmpleado(data.empleado);
    return data.empleado;
  }, []);

  return { empleado, login, logout, checking };
}
