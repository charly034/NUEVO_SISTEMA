import { useState, useRef } from "react";
import { authApi, saveClientSession } from "../services/api.js";
import styles from "./RegistroScreen.module.css";

// ── Utilidades ─────────────────────────────────────────────────────────────────

function slugify(str) {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function emailSugerido(nombre, apellido, empresa) {
  const n = slugify(nombre || "");
  const a = slugify(apellido || "");
  const e = slugify(empresa || "");
  if (!n || !e) return "";
  return a ? `${n}.${a}@${e}.com` : `${n}@${e}.com`;
}

function normalizarCodigo(value) {
  return value.replace(/[\s-]/g, "").toUpperCase().slice(0, 8);
}

// ── Componente principal ────────────────────────────────────────────────────────

export default function RegistroScreen({ onRegistrado, onVolver }) {
  const [paso, setPaso] = useState(1);
  const [codigo, setCodigo] = useState("");
  const [empresa, setEmpresa] = useState(null); // { id, nombre }
  const [loadingCodigo, setLoadingCodigo] = useState(false);
  const [errorCodigo, setErrorCodigo] = useState("");

  const [nombre, setNombre] = useState("");
  const [apellido, setApellido] = useState("");
  const [email, setEmail] = useState("");
  const [emailManual, setEmailManual] = useState(false);
  const [telefono, setTelefono] = useState("");
  const [nacimiento, setNacimiento] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const codigoErrorId = errorCodigo ? "registro-codigo-error" : undefined;
  const registroErrorId = error ? "registro-form-error" : undefined;

  const codigoRef = useRef(null);

  // ── Paso 1: verificar código ──────────────────────────────────────────────────

  const handleCodigo = async (e) => {
    e.preventDefault();
    setErrorCodigo("");
    setLoadingCodigo(true);
    try {
      const data = await authApi.verificarCodigo(normalizarCodigo(codigo));
      setEmpresa(data);
      setPaso(2);
    } catch (err) {
      setErrorCodigo(
        err?.message ||
          "No encontramos ese código. Revisalo o pedí uno nuevo a tu empresa.",
      );
    } finally {
      setLoadingCodigo(false);
    }
  };

  // Actualizar email sugerido cuando cambian nombre/apellido (solo si no lo editó manualmente)
  const handleNombre = (v) => {
    setNombre(v);
    if (!emailManual) setEmail(emailSugerido(v, apellido, empresa?.nombre));
  };
  const handleApellido = (v) => {
    setApellido(v);
    if (!emailManual) setEmail(emailSugerido(nombre, v, empresa?.nombre));
  };
  const handleEmail = (v) => {
    setEmail(v);
    setEmailManual(true);
  };

  // ── Paso 2: crear cuenta ──────────────────────────────────────────────────────

  const handleRegistro = async (e) => {
    e.preventDefault();
    setError("");
    if (password !== password2) return setError("Las contraseñas no coinciden");
    if (password.length < 8)
      return setError("La contraseña debe tener al menos 8 caracteres");
    setLoading(true);
    try {
      const data = await authApi.registro({
        codigo: normalizarCodigo(codigo),
        nombre: nombre.trim(),
        apellido: apellido.trim(),
        email: email.trim(),
        password,
        telefono: telefono.trim() || null,
        fecha_nacimiento: nacimiento || null,
      });
      saveClientSession({ token: data.token, empleado: data.empleado }, false);
      onRegistrado(data.empleado);
    } catch (err) {
      setError(err?.message || "Error al crear la cuenta");
    } finally {
      setLoading(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className={styles.wrap}>
      <div className={styles.card}>
        <div className={styles.logo}>🌿</div>
        <h1 className={styles.titulo}>La Quinta</h1>
        <p className={styles.sub}>Crear cuenta</p>

        {/* Indicador de pasos */}
        <div className={styles.pasos}>
          <div
            className={`${styles.paso} ${paso >= 1 ? styles.pasoActivo : ""}`}
          >
            <span className={styles.pasoNum}>1</span>
            <span className={styles.pasoLabel}>Código</span>
          </div>
          <div className={styles.pasoDivider} />
          <div
            className={`${styles.paso} ${paso >= 2 ? styles.pasoActivo : ""}`}
          >
            <span className={styles.pasoNum}>2</span>
            <span className={styles.pasoLabel}>Tus datos</span>
          </div>
        </div>

        {/* ── Paso 1 ── */}
        {paso === 1 && (
          <form
            onSubmit={handleCodigo}
            className={styles.form}
            aria-busy={loadingCodigo}
          >
            <p className={styles.instruccion}>
              Ingresá el código de tu empresa para continuar. Si no lo tenés,
              pedíselo al responsable de comedor o RR. HH.
            </p>

            <label className={styles.label}>
              Código de empresa
              <input
                ref={codigoRef}
                className={`${styles.input} ${styles.inputCodigo}`}
                value={codigo}
                onChange={(e) => setCodigo(normalizarCodigo(e.target.value))}
                placeholder="ABC123"
                autoFocus
                autoComplete="off"
                spellCheck={false}
                maxLength={8}
                required
                aria-invalid={!!errorCodigo}
                aria-describedby={codigoErrorId}
              />
            </label>

            {errorCodigo && (
              <p
                id="registro-codigo-error"
                role="alert"
                className={styles.error}
              >
                {errorCodigo}
              </p>
            )}

            <button
              type="submit"
              className={styles.btn}
              disabled={loadingCodigo || codigo.length < 4}
            >
              {loadingCodigo ? "Verificando…" : "Continuar →"}
            </button>

            <button type="button" onClick={onVolver} className={styles.linkBtn}>
              ← Volver al inicio de sesión
            </button>
          </form>
        )}

        {/* ── Paso 2 ── */}
        {paso === 2 && empresa && (
          <form
            onSubmit={handleRegistro}
            className={styles.form}
            aria-busy={loading}
          >
            {/* Empresa confirmada */}
            <div className={styles.empresaBanner}>
              ✅ Empresa encontrada: <strong>{empresa.nombre}</strong>
            </div>

            <div className={styles.fila2}>
              <label className={styles.label}>
                Nombre
                <input
                  className={styles.input}
                  value={nombre}
                  onChange={(e) => handleNombre(e.target.value)}
                  required
                  autoFocus
                  placeholder="Martín"
                />
              </label>
              <label className={styles.label}>
                Apellido
                <input
                  className={styles.input}
                  value={apellido}
                  onChange={(e) => handleApellido(e.target.value)}
                  required
                  placeholder="García"
                />
              </label>
            </div>

            <label className={styles.label}>
              Email
              <input
                className={styles.input}
                type="email"
                value={email}
                onChange={(e) => handleEmail(e.target.value)}
                required
                placeholder="tu@email.com"
                autoComplete="username"
                inputMode="email"
              />
              {!emailManual && email && (
                <span className={styles.hint}>Sugerido — podés cambiarlo</span>
              )}
            </label>

            <label className={styles.label}>
              Teléfono <span className={styles.opcional}>(opcional)</span>
              <input
                className={styles.input}
                type="tel"
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                placeholder="+54 261 555-0000"
                inputMode="tel"
              />
            </label>

            <label className={styles.label}>
              Fecha de nacimiento{" "}
              <span className={styles.opcional}>(opcional)</span>
              <input
                className={styles.input}
                type="date"
                value={nacimiento}
                onChange={(e) => setNacimiento(e.target.value)}
              />
            </label>

            <label className={styles.label}>
              Contraseña
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
                  aria-invalid={!!error}
                  aria-describedby={registroErrorId}
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
                  aria-describedby={registroErrorId}
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
              <p id="registro-form-error" role="alert" className={styles.error}>
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
                  Creando cuenta…
                </span>
              ) : (
                "Crear mi cuenta"
              )}
            </button>

            <button
              type="button"
              onClick={() => setPaso(1)}
              className={styles.linkBtn}
            >
              ← Cambiar código de empresa
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
