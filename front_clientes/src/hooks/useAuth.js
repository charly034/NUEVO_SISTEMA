import { useState, useCallback, useEffect } from 'react';
import { authApi, saveClientSession, clearClientSession } from '../services/api.js';
import { medirPromesaPerformance } from '../utils/performance.js';

function readStoredEmpleado() {
  try {
    const json = localStorage.getItem('empleado') || sessionStorage.getItem('empleado');
    return json ? JSON.parse(json) : null;
  } catch {
    return null;
  }
}

function hasToken() {
  return !!(localStorage.getItem('token') || sessionStorage.getItem('token'));
}

function isRemembered() {
  return !!localStorage.getItem('token');
}

export function useAuth() {
  const [empleado, setEmpleado] = useState(() => readStoredEmpleado());
  const [checking, setChecking] = useState(() => hasToken() && !readStoredEmpleado());

  const logout = useCallback(() => {
    clearClientSession();
    setEmpleado(null);
  }, []);

  useEffect(() => {
    const unauthorized = () => logout();
    window.addEventListener('cliente:unauthorized', unauthorized);
    return () => window.removeEventListener('cliente:unauthorized', unauthorized);
  }, [logout]);

  useEffect(() => {
    if (!hasToken()) {
      return;
    }
    medirPromesaPerformance('auth:check-sesion', () => authApi.me())
      .then((data) => {
        const remember = isRemembered();
        saveClientSession({ token: localStorage.getItem('token') || sessionStorage.getItem('token'), empleado: data }, remember);
        setEmpleado(data);
      })
      .catch(logout)
      .finally(() => setChecking(false));
  }, [logout]);

  const login = useCallback(async (email, password, remember = false) => {
    const data = await medirPromesaPerformance('auth:login', () =>
      authApi.login(email, password, remember),
    );
    saveClientSession({ token: data.token, empleado: data.empleado }, remember);
    setEmpleado(data.empleado);
    return data.empleado;
  }, []);

  const setSession = useCallback((emp) => {
    setEmpleado(emp);
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    const remember = isRemembered();
    if (token) saveClientSession({ token, empleado: emp }, remember);
  }, []);

  return { empleado, login, logout, setSession, checking };
}
