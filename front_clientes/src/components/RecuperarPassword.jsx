import { useState } from "react";
import { authApi } from "../services/api.js";
import styles from "./RecuperarPassword.module.css";

export default function RecuperarPassword({ onVolver, onExito }) {
  const [codigo, setCodigo] = useState("");
  const [paso, setPaso] = useState(1); // 1 = ingresar código, 2 = nueva contraseña
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [showPass, setShowPass] = useState(false);
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
    <div className={styles.wrap}>
      <div className={styles.card}>
        <div className={styles.icono}>🔑</div>
        <h2 className={styles.titulo}>Recuperar contraseña</h2>

        {paso === 1 && (
          <form
            onSubmit={handleCodigo}
            className={styles.form}
            aria-busy={loading}
          >
            <p className={styles.info}>
              Pedí un código de recuperación a tu empresa y escribilo acá. Por
              seguridad, usalo apenas te lo entreguen.
            </p>
            <label className={styles.label}>
              Código de recuperación
              <input
                className={`${styles.input} ${styles.inputCodigo}`}
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
              />
            </label>
            {error && (
              <p id="recuperar-error" role="alert" className={styles.error}>
                {error}
              </p>
            )}
            <button type="submit" className={styles.btn}>
              Continuar →
            </button>
            <button type="button" onClick={onVolver} className={styles.linkBtn}>
              ← Volver al inicio de sesión
            </button>
          </form>
        )}

        {paso === 2 && (
          <form
            onSubmit={handleSubmit}
            className={styles.form}
            aria-busy={loading}
          >
            <p className={styles.info}>
              Código <strong className={styles.codigo}>{codigo}</strong>. Elegí
              tu nueva contraseña.
            </p>

            <label className={styles.label}>
              Nueva contraseña
              <div className={styles.passWrap}>
                <input
                  className={`${styles.input} ${styles.inputConIcono}`}
                  type={showPass ? "text" : "password"}
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
                <button
                  type="button"
                  onClick={() => setShowPass((v) => !v)}
                  className={styles.eyeBtn}
                  aria-label={showPass ? "Ocultar" : "Ver"}
                  aria-pressed={showPass}
                >
                  {showPass ? (
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      className={styles.eyeIco}
                    >
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      className={styles.eyeIco}
                    >
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </label>

            <label className={styles.label}>
              Confirmar contraseña
              <div className={styles.passWrap}>
                <input
                  className={`${styles.input} ${styles.inputConIcono} ${password2 && password2 !== password ? styles.inputError : ""}`}
                  type={showPass ? "text" : "password"}
                  value={password2}
                  onChange={(e) => setPassword2(e.target.value)}
                  required
                  placeholder="Repetí la contraseña"
                  autoComplete="new-password"
                  aria-invalid={
                    !!error || (password2 !== "" && password2 !== password)
                  }
                  aria-describedby={errorId}
                />
                <button
                  type="button"
                  onClick={() => setShowPass((v) => !v)}
                  className={styles.eyeBtn}
                  aria-label={showPass ? "Ocultar" : "Ver"}
                  aria-pressed={showPass}
                >
                  {showPass ? (
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      className={styles.eyeIco}
                    >
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      className={styles.eyeIco}
                    >
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </label>

            {error && (
              <p id="recuperar-error" role="alert" className={styles.error}>
                {error}
              </p>
            )}

            <button type="submit" className={styles.btn} disabled={loading}>
              {loading ? (
                <span className={styles.loadingRow}>
                  <svg
                    className={styles.spinner}
                    viewBox="0 0 24 24"
                    fill="none"
                  >
                    <circle
                      className={styles.spinnerTrack}
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="white"
                      strokeWidth="4"
                    />
                    <path
                      className={styles.spinnerFill}
                      fill="white"
                      d="M4 12a8 8 0 018-8v8z"
                    />
                  </svg>
                  Guardando…
                </span>
              ) : (
                "Guardar nueva contraseña"
              )}
            </button>
            <button
              type="button"
              onClick={() => {
                setPaso(1);
                setError("");
              }}
              className={styles.linkBtn}
            >
              ← Cambiar código
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
