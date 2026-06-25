import { useState } from "react";
import { authApi } from "../services/api.js";
import styles from "./PerfilCliente.module.css";

const PLANES = {
  basico: "Básico",
  con_postre: "Con postre",
  con_postre_bebida: "Con postre y bebida",
};

function PasswordVisibilityButton({ showPass, onToggle }) {
  return (
    <button
      type="button"
      onClick={onToggle}
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
  );
}

function formatFecha(iso) {
  if (!iso) return null;
  const [y, m, d] = iso.split("T")[0].split("-");
  return `${d}/${m}/${y}`;
}

// ── Formulario cambio de contraseña ──────────────────────────────────────────
function CambiarPasswordForm({ onCerrar }) {
  const [actual, setActual] = useState("");
  const [nuevo, setNuevo] = useState("");
  const [nuevo2, setNuevo2] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState(false);
  const errorId = error ? "perfil-password-error" : undefined;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (nuevo !== nuevo2) return setError("Las contraseñas no coinciden");
    if (nuevo.length < 8) return setError("Mínimo 8 caracteres");
    setLoading(true);
    try {
      await authApi.cambiarPassword(actual, nuevo);
      setOk(true);
    } catch (err) {
      setError(err?.message || "Error al cambiar la contraseña");
    } finally {
      setLoading(false);
    }
  };

  if (ok)
    return (
      <div className={styles.passwordOk}>
        <div className={styles.passwordOkIcon}>✅</div>
        <p className={styles.passwordOkText}>¡Contraseña actualizada!</p>
        <button onClick={onCerrar} className={styles.passwordBtnOk}>
          Listo
        </button>
      </div>
    );

  return (
    <form
      onSubmit={handleSubmit}
      className={styles.passwordForm}
      aria-busy={loading}
    >
      <label className={styles.passwordLabel}>
        Contraseña actual
        <div className={styles.passwordFieldWrap}>
          <input
            className={`${styles.passwordInput} ${styles.passwordInputWithIcon}`}
            type={showPass ? "text" : "password"}
            value={actual}
            onChange={(e) => setActual(e.target.value)}
            required
            autoFocus
            autoComplete="current-password"
            aria-invalid={!!error}
            aria-describedby={errorId}
          />
          <PasswordVisibilityButton
            showPass={showPass}
            onToggle={() => setShowPass((v) => !v)}
          />
        </div>
      </label>
      <label className={styles.passwordLabel}>
        Nueva contraseña
        <div className={styles.passwordFieldWrap}>
          <input
            className={`${styles.passwordInput} ${styles.passwordInputWithIcon}`}
            type={showPass ? "text" : "password"}
            value={nuevo}
            onChange={(e) => setNuevo(e.target.value)}
            required
            minLength={8}
            placeholder="Mínimo 8 caracteres"
            autoComplete="new-password"
            aria-invalid={!!error}
            aria-describedby={errorId}
          />
          <PasswordVisibilityButton
            showPass={showPass}
            onToggle={() => setShowPass((v) => !v)}
          />
        </div>
      </label>
      <label className={styles.passwordLabel}>
        Confirmar nueva contraseña
        <div className={styles.passwordFieldWrap}>
          <input
            className={`${styles.passwordInput} ${styles.passwordInputWithIcon} ${nuevo2 && nuevo2 !== nuevo ? styles.passwordInputError : ""}`}
            type={showPass ? "text" : "password"}
            value={nuevo2}
            onChange={(e) => setNuevo2(e.target.value)}
            required
            autoComplete="new-password"
            aria-invalid={!!error || (nuevo2 !== "" && nuevo2 !== nuevo)}
            aria-describedby={errorId}
          />
          <PasswordVisibilityButton
            showPass={showPass}
            onToggle={() => setShowPass((v) => !v)}
          />
        </div>
      </label>
      {error && (
        <p
          id="perfil-password-error"
          role="alert"
          className={styles.passwordError}
        >
          {error}
        </p>
      )}
      <button
        type="submit"
        className={styles.passwordBtnPrimary}
        disabled={loading}
      >
        {loading ? "Guardando…" : "Guardar nueva contraseña"}
      </button>
      <button
        type="button"
        onClick={onCerrar}
        className={styles.passwordBtnLink}
      >
        Cancelar
      </button>
    </form>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function PerfilCliente({
  empleado,
  onLogout,
  onEmpleadoUpdate,
}) {
  const iniciales =
    `${empleado.nombre?.[0] ?? ""}${empleado.apellido?.[0] ?? ""}`.toUpperCase();
  const plan = PLANES[empleado.empresa?.plan] ?? empleado.empresa?.plan ?? "—";

  const [editando, setEditando] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [guardado, setGuardado] = useState(false);

  const [form, setForm] = useState({
    nombre: empleado.nombre ?? "",
    apellido: empleado.apellido ?? "",
    telefono: empleado.telefono ?? "",
    fecha_nacimiento: empleado.fecha_nacimiento
      ? empleado.fecha_nacimiento.split("T")[0]
      : "",
  });

  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const handleGuardar = async (e) => {
    e.preventDefault();
    setError("");
    if (!form.nombre.trim() || !form.apellido.trim())
      return setError("Nombre y apellido son obligatorios");
    setLoading(true);
    try {
      const updated = await authApi.actualizarPerfil(form);
      onEmpleadoUpdate?.({ ...empleado, ...updated });
      setEditando(false);
      setGuardado(true);
      setTimeout(() => setGuardado(false), 3000);
    } catch (err) {
      setError(err?.message || "Error al guardar");
    } finally {
      setLoading(false);
    }
  };

  const cancelar = () => {
    setForm({
      nombre: empleado.nombre ?? "",
      apellido: empleado.apellido ?? "",
      telefono: empleado.telefono ?? "",
      fecha_nacimiento: empleado.fecha_nacimiento
        ? empleado.fecha_nacimiento.split("T")[0]
        : "",
    });
    setError("");
    setEditando(false);
  };

  return (
    <div className={styles.wrap}>
      {/* Avatar + nombre */}
      <div className={styles.hero}>
        <div className={styles.avatar}>{iniciales}</div>
        <div>
          <h2 className={styles.nombre}>
            {empleado.nombre} {empleado.apellido}
          </h2>
          <p className={styles.empresa}>{empleado.empresa?.nombre}</p>
        </div>
      </div>

      {/* Toast guardado */}
      {guardado && <div className={styles.toast}>✅ Datos actualizados</div>}

      {/* ── Datos personales ── */}
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <span className={styles.cardLabel}>Mis datos</span>
          {!editando && (
            <button
              onClick={() => setEditando(true)}
              className={styles.editBtn}
            >
              ✏️ Editar
            </button>
          )}
        </div>

        {editando ? (
          <form onSubmit={handleGuardar} className={styles.formStack}>
            <div className={styles.fila2}>
              <label className={styles.label}>
                Nombre
                <input
                  className={styles.input}
                  value={form.nombre}
                  onChange={(e) => set("nombre", e.target.value)}
                  required
                  autoFocus
                />
              </label>
              <label className={styles.label}>
                Apellido
                <input
                  className={styles.input}
                  value={form.apellido}
                  onChange={(e) => set("apellido", e.target.value)}
                  required
                />
              </label>
            </div>
            <label className={styles.label}>
              Teléfono <span className={styles.opcional}>(opcional)</span>
              <input
                className={styles.input}
                type="tel"
                value={form.telefono}
                onChange={(e) => set("telefono", e.target.value)}
                placeholder="+54 261 555-0000"
              />
            </label>
            <label className={styles.label}>
              Fecha de nacimiento{" "}
              <span className={styles.opcional}>(opcional)</span>
              <input
                className={styles.input}
                type="date"
                value={form.fecha_nacimiento}
                onChange={(e) => set("fecha_nacimiento", e.target.value)}
              />
            </label>
            {error && (
              <p role="alert" className={styles.errorMsg}>
                {error}
              </p>
            )}
            <div className={styles.actionRow}>
              <button
                type="submit"
                className={styles.btnPrimary}
                disabled={loading}
              >
                {loading ? "Guardando…" : "Guardar cambios"}
              </button>
              <button
                type="button"
                onClick={cancelar}
                className={styles.btnCancel}
              >
                Cancelar
              </button>
            </div>
          </form>
        ) : (
          <div>
            <Fila
              label="Nombre"
              valor={`${empleado.nombre} ${empleado.apellido}`}
            />
            <Fila label="Email" valor={empleado.email} />
            <Fila label="Teléfono" valor={empleado.telefono || "—"} />
            <Fila
              label="Cumpleaños"
              valor={formatFecha(empleado.fecha_nacimiento) || "—"}
              last
            />
          </div>
        )}
      </div>

      {/* ── Empresa ── */}
      <div className={styles.card}>
        <span className={styles.cardLabel}>Mi empresa</span>
        <div>
          <Fila label="Empresa" valor={empleado.empresa?.nombre ?? "—"} />
          <Fila label="Plan" valor={plan} last />
        </div>
      </div>

      {/* ── Seguridad ── */}
      <div className={styles.card}>
        <span className={styles.cardLabel}>Seguridad</span>
        {showPass ? (
          <CambiarPasswordForm onCerrar={() => setShowPass(false)} />
        ) : (
          <button
            onClick={() => setShowPass(true)}
            className={styles.btnSecundario}
          >
            🔒 Cambiar contraseña
          </button>
        )}
      </div>

      {/* Cerrar sesión */}
      <button onClick={onLogout} className={styles.btnLogout}>
        Cerrar sesión
      </button>

      <p className={styles.footerNote}>La Quinta · Sistema de pedidos</p>
    </div>
  );
}

function Fila({ label, valor, last }) {
  return (
    <div className={`${styles.fila} ${last ? styles.filaLast : ""}`}>
      <span className={styles.filaLabel}>{label}</span>
      <span className={styles.filaValor}>{valor}</span>
    </div>
  );
}
