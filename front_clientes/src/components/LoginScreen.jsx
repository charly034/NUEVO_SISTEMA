import { useState } from "react";
import styles from "./LoginScreen.module.css";

export default function LoginScreen({ onLogin, onRegistrar, onRecuperar }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
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
    <div className={styles.wrap}>
      <div className={styles.card}>
        <div className={styles.logo}>🌿</div>
        <h1 className={styles.titulo}>La Quinta</h1>
        <p className={styles.sub}>Sistema de pedidos</p>
        <p className={styles.loginHint}>
          Entrá con el email registrado en tu empresa. Si es tu primera vez, usá
          el código que te dieron.
        </p>

        <form
          onSubmit={handleSubmit}
          className={styles.form}
          aria-busy={loading}
        >
          {/* Email */}
          <label className={styles.label}>
            Email
            <input
              className={styles.input}
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
          </label>

          {/* Contraseña con toggle */}
          <label className={styles.label}>
            Contraseña
            <div className={styles.passWrap}>
              <input
                className={`${styles.input} ${styles.inputConIcono}`}
                type={showPass ? "text" : "password"}
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                aria-invalid={!!error}
                aria-describedby={errorId}
              />
              <button
                type="button"
                onClick={() => setShowPass((v) => !v)}
                className={styles.eyeBtn}
                aria-label={showPass ? "Ocultar contraseña" : "Ver contraseña"}
                aria-pressed={showPass}
              >
                {showPass ? (
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className={styles.eyeIcon}
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
                    className={styles.eyeIcon}
                  >
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
          </label>

          {/* Recordarme */}
          <label className={styles.checkLabel}>
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              className={styles.checkbox}
            />
            Mantener sesión activa
          </label>

          {/* Error */}
          {error && (
            <p id="login-error" role="alert" className={styles.error}>
              {error}
            </p>
          )}

          {/* Botón */}
          <button type="submit" className={styles.btn} disabled={loading}>
            {loading ? (
              <span className={styles.loadingRow}>
                <svg className={styles.spinner} viewBox="0 0 24 24" fill="none">
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
                Ingresando…
              </span>
            ) : (
              "Ingresar"
            )}
          </button>

          {onRecuperar && (
            <button
              type="button"
              onClick={onRecuperar}
              className={styles.recuperarLink}
            >
              ¿Olvidaste tu contraseña?
            </button>
          )}

          {onRegistrar && (
            <div className={styles.registroRow}>
              <span className={styles.registroTexto}>¿Primera vez?</span>
              <button
                type="button"
                onClick={onRegistrar}
                className={styles.registroLink}
              >
                Crear cuenta con código
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
