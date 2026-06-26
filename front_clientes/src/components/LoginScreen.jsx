import { useState } from "react";
import AuthLayout from "../compartido/layout/AuthLayout.jsx";
import Alerta from "../compartido/ui/Alerta.jsx";
import Boton from "../compartido/ui/Boton.jsx";
import CampoPassword from "../compartido/ui/CampoPassword.jsx";
import CampoTexto from "../compartido/ui/CampoTexto.jsx";
import Checkbox from "../compartido/ui/Checkbox.jsx";

export default function LoginScreen({ onLogin, onRegistrar, onRecuperar }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const errorId = error ? "login-error" : undefined;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await onLogin(email.trim(), password, remember);
    } catch (err) {
      setError(
        err?.message ||
          "No pudimos iniciar sesión. Revisá tu email y contraseña.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout subtitulo="Sistema de pedidos">
      <p className="-mt-1 mb-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm leading-snug text-slate-500">
        Entrá con el email registrado en tu empresa. Si es tu primera vez, usá
        el código que te dieron.
      </p>

      <form
        onSubmit={handleSubmit}
        className="flex flex-col gap-2.5 text-left"
        aria-busy={loading}
      >
        <CampoTexto
          id="login-email"
          label="Email"
          type="email"
          required
          autoFocus
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="usuario@empresa.com"
          aria-invalid={!!error}
          aria-describedby={errorId}
        />

        <CampoPassword
          id="login-password"
          label="Contraseña"
          required
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          aria-invalid={!!error}
          aria-describedby={errorId}
        />

        <Checkbox
          checked={remember}
          onChange={(e) => setRemember(e.target.checked)}
          label="Mantener sesión activa"
        />

        {error && (
          <Alerta id="login-error" variante="error">
            {error}
          </Alerta>
        )}

        <Boton type="submit" anchoCompleto cargando={loading}>
          {loading ? "Ingresando..." : "Ingresar"}
        </Boton>

        {onRecuperar && (
          <Boton
            type="button"
            variante="fantasma"
            className="min-h-6 py-1 text-sm font-medium"
            onClick={onRecuperar}
            anchoCompleto
          >
            ¿Olvidaste tu contraseña?
          </Boton>
        )}

        {onRegistrar && (
          <div className="flex flex-col items-center justify-center gap-1 pt-1 text-center text-sm sm:flex-row sm:gap-2">
            <span className="text-slate-500">¿Primera vez?</span>
            <Boton
              type="button"
              variante="fantasma"
              className="min-h-6 px-0 py-0 font-bold text-[var(--verde)]"
              onClick={onRegistrar}
            >
              Crear cuenta con código
            </Boton>
          </div>
        )}
      </form>
    </AuthLayout>
  );
}
