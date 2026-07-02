import { useCallback, useState } from "react";
import { authApi } from "../services/api.js";

export const VISTAS_AUTENTICACION = {
  LOGIN: "login",
  REGISTRO: "registro",
  RECUPERAR: "recuperar",
};

const formularioLoginInicial = {
  email: "",
  password: "",
  recordarSesion: false,
  mostrarPassword: false,
};

const formularioRegistroInicial = {
  codigo: "",
  nombre: "",
  apellido: "",
  email: "",
  telefono: "",
  fecha_nacimiento: "",
  password: "",
};

const formularioRecuperacionInicial = {
  codigo: "",
  password: "",
  confirmacion: "",
};

function obtenerMensajeError(error, fallback) {
  return error?.message || fallback;
}

function limpiarTexto(valor) {
  return String(valor || "").trim();
}

function normalizarCodigo(codigo) {
  return limpiarTexto(codigo).toUpperCase();
}

function validarEmail(email) {
  return /\S+@\S+\.\S+/.test(email);
}

export function useLoginForm(onLogin) {
  const [formulario, setFormulario] = useState(formularioLoginInicial);
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  const actualizarCampo = useCallback((campo, valor) => {
    setFormulario((actual) => ({ ...actual, [campo]: valor }));
  }, []);

  const alternarRecordarSesion = useCallback(() => {
    setFormulario((actual) => ({
      ...actual,
      recordarSesion: !actual.recordarSesion,
    }));
  }, []);

  const alternarPasswordVisible = useCallback(() => {
    setFormulario((actual) => ({
      ...actual,
      mostrarPassword: !actual.mostrarPassword,
    }));
  }, []);

  const enviar = useCallback(async (event) => {
    event?.preventDefault();

    const email = limpiarTexto(formulario.email);
    if (!email) {
      setError("Ingresa tu email.");
      return false;
    }
    if (!validarEmail(email)) {
      setError("Ingresa un email valido.");
      return false;
    }
    if (!formulario.password) {
      setError("Ingresa tu contrasena.");
      return false;
    }

    setError("");
    setCargando(true);
    try {
      await onLogin(email, formulario.password, formulario.recordarSesion);
      return true;
    } catch (errorLogin) {
      setError(obtenerMensajeError(errorLogin, "Email o contrasena incorrectos."));
      return false;
    } finally {
      setCargando(false);
    }
  }, [formulario, onLogin]);

  return {
    formulario,
    error,
    cargando,
    actualizarCampo,
    alternarRecordarSesion,
    alternarPasswordVisible,
    enviar,
  };
}

export function useRegistroForm(onRegistroExitoso) {
  const [formulario, setFormulario] = useState(formularioRegistroInicial);
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  const actualizarCampo = useCallback((campo, valor) => {
    setFormulario((actual) => ({ ...actual, [campo]: valor }));
  }, []);

  const enviar = useCallback(async (event) => {
    event?.preventDefault();

    const payload = {
      codigo: normalizarCodigo(formulario.codigo),
      nombre: limpiarTexto(formulario.nombre),
      apellido: limpiarTexto(formulario.apellido),
      email: limpiarTexto(formulario.email),
      telefono: limpiarTexto(formulario.telefono),
      fecha_nacimiento: limpiarTexto(formulario.fecha_nacimiento),
      password: formulario.password,
    };

    if (
      !payload.codigo ||
      !payload.nombre ||
      !payload.apellido ||
      !payload.email ||
      !payload.telefono ||
      !payload.fecha_nacimiento ||
      !payload.password
    ) {
      setError("Completa todos los campos.");
      return false;
    }
    if (!validarEmail(payload.email)) {
      setError("Ingresa un email laboral valido.");
      return false;
    }
    if (payload.password.length < 8) {
      setError("La contrasena debe tener al menos 8 caracteres.");
      return false;
    }

    setError("");
    setCargando(true);
    try {
      const sesion = await authApi.registro(payload);
      await onRegistroExitoso(sesion, false);
      return true;
    } catch (errorRegistro) {
      setError(obtenerMensajeError(errorRegistro, "No se pudo crear la cuenta. Revisa el codigo de empresa."));
      return false;
    } finally {
      setCargando(false);
    }
  }, [formulario, onRegistroExitoso]);

  return {
    formulario,
    error,
    cargando,
    actualizarCampo,
    enviar,
  };
}

export function useRecuperarPasswordForm() {
  const [formulario, setFormulario] = useState(formularioRecuperacionInicial);
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);
  const [completado, setCompletado] = useState(false);

  const actualizarCampo = useCallback((campo, valor) => {
    setFormulario((actual) => ({ ...actual, [campo]: valor }));
  }, []);

  const enviar = useCallback(async (event) => {
    event?.preventDefault();

    const codigo = normalizarCodigo(formulario.codigo);
    if (codigo.length < 5) {
      setError("Ingresa el codigo de recuperacion completo.");
      return false;
    }
    if (formulario.password.length < 8) {
      setError("La nueva contrasena debe tener al menos 8 caracteres.");
      return false;
    }
    if (formulario.password !== formulario.confirmacion) {
      setError("Las contrasenas no coinciden.");
      return false;
    }

    setError("");
    setCargando(true);
    try {
      await authApi.usarResetCode(codigo, formulario.password);
      setCompletado(true);
      return true;
    } catch (errorRecuperacion) {
      setError(obtenerMensajeError(
        errorRecuperacion,
        "El codigo no es valido o ya vencio. Pedi uno nuevo a tu empresa.",
      ));
      return false;
    } finally {
      setCargando(false);
    }
  }, [formulario]);

  return {
    formulario,
    error,
    cargando,
    completado,
    actualizarCampo,
    enviar,
  };
}
