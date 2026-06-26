import { useState } from "react";
import AuthLayout from "../compartido/layout/AuthLayout.jsx";
import Alerta from "../compartido/ui/Alerta.jsx";
import Boton from "../compartido/ui/Boton.jsx";
import CampoPassword from "../compartido/ui/CampoPassword.jsx";
import CampoTexto from "../compartido/ui/CampoTexto.jsx";
import { authApi } from "../services/api.js";

export default function RecuperarPassword({ onVolver, onExito }) {
  const [codigo, setCodigo] = useState("");
  const [paso, setPaso] = useState(1);
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const errorId = error ? "recuperar-error" : undefined;

  const handleCodigo = (e) => {
    e.preventDefault();
    if (codigo.trim().length < 5) return setError("Ingresá el código completo");
    setError("");
    setPaso(2);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (password !== password2) return setError("Las contraseñas no coinciden");
    if (password.length < 8) return setError("Mínimo 8 caracteres");
    setLoading(true);
    try {
      await authApi.usarResetCode(codigo.trim().toUpperCase(), password);
      onExito();
    } catch (err) {
      setError(
        err?.message ||
          "El código no es válido o ya venció. Pedí uno nuevo a tu empresa.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout icono="🔑" titulo="Recuperar contraseña" compacto>
      {paso === 1 && (
        <form
          onSubmit={handleCodigo}
          className="flex flex-col gap-3.5 text-left"
          aria-busy={loading}
        >
          <p className="text-sm leading-relaxed text-slate-500">
            Pedí un código de recuperación a tu empresa y escribilo acá. Por
            seguridad, usalo apenas te lo entreguen.
          </p>

          <CampoTexto
            id="recuperar-codigo"
            label="Código de recuperación"
            value={codigo}
            onChange={(e) => setCodigo(e.target.value.toUpperCase())}
            placeholder="XXX-XXX"
            autoFocus
            autoComplete="off"
            spellCheck={false}
            maxLength={7}
            required
            aria-invalid={!!error}
            aria-describedby={errorId}
            inputClassName="text-center text-xl font-bold uppercase tracking-[0.2em]"
          />

          {error && (
            <Alerta id="recuperar-error" variante="error">
              {error}
            </Alerta>
          )}

          <Boton type="submit" anchoCompleto>
            Continuar →
          </Boton>

          <Boton
            type="button"
            variante="fantasma"
            className="min-h-7 py-1 text-sm font-medium"
            onClick={onVolver}
            anchoCompleto
          >
            Volver al inicio de sesión
          </Boton>
        </form>
      )}

      {paso === 2 && (
        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-3.5 text-left"
          aria-busy={loading}
        >
          <p className="text-sm leading-relaxed text-slate-500">
            Código{" "}
            <strong className="font-mono text-[var(--verde)]">{codigo}</strong>.
            Elegí tu nueva contraseña.
          </p>

          <CampoPassword
            id="recuperar-password"
            label="Nueva contraseña"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            placeholder="Mínimo 8 caracteres"
            autoComplete="new-password"
            autoFocus
            aria-invalid={!!error}
            aria-describedby={errorId}
          />

          <CampoPassword
            id="recuperar-password-confirmacion"
            label="Confirmar contraseña"
            value={password2}
            onChange={(e) => setPassword2(e.target.value)}
            required
            placeholder="Repetí la contraseña"
            autoComplete="new-password"
            error={password2 && password2 !== password ? "No coincide" : null}
            aria-invalid={
              !!error || (password2 !== "" && password2 !== password)
            }
            aria-describedby={errorId}
          />

          {error && (
            <Alerta id="recuperar-error" variante="error">
              {error}
            </Alerta>
          )}

          <Boton type="submit" anchoCompleto cargando={loading}>
            {loading ? "Guardando..." : "Guardar nueva contraseña"}
          </Boton>

          <Boton
            type="button"
            variante="fantasma"
            className="min-h-7 py-1 text-sm font-medium"
            onClick={() => {
              setPaso(1);
              setError("");
            }}
            anchoCompleto
          >
            Cambiar código
          </Boton>
        </form>
      )}
    </AuthLayout>
  );
}
