import { useState, useCallback, useEffect } from 'react';
import { authApi, saveClientSession, clearClientSession } from './api.js';

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
  const [checking, setChecking] = useState(() => hasToken());

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
    if (!hasToken()) return;
    authApi.me()
      .then((data) => {
        // Re-guardar actualizando datos pero manteniendo la preferencia de remember
        const remember = isRemembered();
        saveClientSession({ token: localStorage.getItem('token') || sessionStorage.getItem('token'), empleado: data }, remember);
        setEmpleado(data);
      })
      .catch(logout)
      .finally(() => setChecking(false));
  }, [logout]);

  const login = useCallback(async (email, password, remember = false) => {
    const data = await authApi.login(email, password, remember);
    saveClientSession({ token: data.token, empleado: data.empleado }, remember);
    setEmpleado(data.empleado);
    return data.empleado;
  }, []);

  // Actualiza el empleado en memoria y en storage (registro, edición de perfil)
  const setSession = useCallback((emp) => {
    setEmpleado(emp);
    // Actualizar storage preservando el token y el tipo de sesión
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    const remember = isRemembered();
    if (token) saveClientSession({ token, empleado: emp }, remember);
  }, []);

  return { empleado, login, logout, setSession, checking };
}
