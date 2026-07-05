import { useState } from "react";
import { CheckCircle2, LockKeyhole, Pencil, ShieldCheck } from "lucide-react";
import Alerta from "../compartido/ui/Alerta.jsx";
import Boton from "../compartido/ui/Boton.jsx";
import CampoPassword from "../compartido/ui/CampoPassword.jsx";
import CampoTexto from "../compartido/ui/CampoTexto.jsx";
import Pagina from "../compartido/ui/Pagina.jsx";
import Tarjeta from "../compartido/ui/Tarjeta.jsx";
import { authApi } from "../services/api.js";

const PLANES = {
  basico: "Básico",
  con_postre: "Con postre",
  con_postre_bebida: "Con postre y bebida",
};

function formatFecha(iso) {
  if (!iso) return null;
  const [y, m, d] = iso.split("T")[0].split("-");
  return `${d}/${m}/${y}`;
}

function CambiarPasswordForm({ onCerrar }) {
  const [actual, setActual] = useState("");
  const [nuevo, setNuevo] = useState("");
  const [nuevo2, setNuevo2] = useState("");
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

  if (ok) {
    return (
      <div className="py-2 text-center">
        <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#f0f7ee] text-[#2d5a27]">
          <CheckCircle2 className="h-6 w-6" aria-hidden="true" />
        </span>
        <p className="mb-3 font-black text-[#2d5a27]">
          Contraseña actualizada
        </p>
        <Boton type="button" anchoCompleto onClick={onCerrar}>
          Listo
        </Boton>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3" aria-busy={loading}>
      <CampoPassword
        id="perfil-password-actual"
        label="Contraseña actual"
        value={actual}
        onChange={(e) => setActual(e.target.value)}
        required
        autoFocus
        autoComplete="current-password"
        aria-invalid={!!error}
        aria-describedby={errorId}
      />

      <CampoPassword
        id="perfil-password-nuevo"
        label="Nueva contraseña"
        value={nuevo}
        onChange={(e) => setNuevo(e.target.value)}
        required
        minLength={8}
        placeholder="Mínimo 8 caracteres"
        autoComplete="new-password"
        aria-invalid={!!error}
        aria-describedby={errorId}
      />

      <CampoPassword
        id="perfil-password-confirmacion"
        label="Confirmar nueva contraseña"
        value={nuevo2}
        onChange={(e) => setNuevo2(e.target.value)}
        required
        autoComplete="new-password"
        error={nuevo2 && nuevo2 !== nuevo ? "No coincide" : null}
        aria-invalid={!!error || (nuevo2 !== "" && nuevo2 !== nuevo)}
        aria-describedby={errorId}
      />

      {error && (
        <Alerta id="perfil-password-error" variante="error">
          {error}
        </Alerta>
      )}

      <Boton type="submit" anchoCompleto cargando={loading}>
        {loading ? "Guardando..." : "Guardar nueva contraseña"}
      </Boton>
      <Boton type="button" variante="fantasma" anchoCompleto onClick={onCerrar}>
        Cancelar
      </Boton>
    </form>
  );
}

function FilaDato({ label, valor, last }) {
  return (
    <div
      className={
        last
          ? "flex items-center justify-between gap-4 py-3"
          : "flex items-center justify-between gap-4 border-b border-[#eee8df] py-3"
      }
    >
      <span className="text-sm font-bold text-[#716c64]">{label}</span>
      <span className="max-w-[62%] break-words text-right text-sm font-black text-[#1a1a1a]">
        {valor}
      </span>
    </div>
  );
}

function TituloSeccion({ children }) {
  return (
    <span className="mb-3 block text-[0.72rem] font-black uppercase tracking-wide text-[#5f7f55]">
      {children}
    </span>
  );
}

export default function PerfilCliente({
  empleado,
  onLogout,
  onEmpleadoUpdate,
}) {
  const iniciales =
    `${empleado.nombre?.[0] ?? ""}${empleado.apellido?.[0] ?? ""}`.toUpperCase();
  const plan = empleado.empresa?.plan_detalle?.nombre
    ?? empleado.empresa?.plan_nombre
    ?? PLANES[empleado.empresa?.plan]
    ?? empleado.empresa?.plan
    ?? "-";

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

  const setCampo = (campo, valor) =>
    setForm((actual) => ({ ...actual, [campo]: valor }));

  const handleGuardar = async (e) => {
    e.preventDefault();
    setError("");
    if (!form.nombre.trim() || !form.apellido.trim()) {
      return setError("Nombre y apellido son obligatorios");
    }
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
    <Pagina className="max-w-[480px] md:max-w-[760px] lg:max-w-[860px]">
      <header className="mb-6 flex items-center gap-4 px-1">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-[#2d5a27] text-2xl font-black text-white shadow-[0_12px_26px_rgba(45,90,39,0.16)]">
          {iniciales}
        </div>
        <div className="min-w-0">
          <p className="text-[0.72rem] font-black uppercase tracking-wide text-[#5f7f55]">
            Mi cuenta
          </p>
          <h2 className="mt-1 text-[1.35rem] font-black leading-tight text-[#1a1a1a]">
            {empleado.nombre} {empleado.apellido}
          </h2>
          <p className="mt-1 text-[0.95rem] font-medium leading-tight text-[#716c64]">
            {empleado.empresa?.nombre}
          </p>
        </div>
      </header>

      {guardado && (
        <Alerta variante="exito" className="mb-3">
          Datos actualizados
        </Alerta>
      )}

      <Tarjeta className="mb-3 px-4 py-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <TituloSeccion>Mis datos</TituloSeccion>
          {!editando && (
            <Boton
              type="button"
              variante="fantasma"
              className="min-h-0 px-0 py-0 text-sm font-black text-[#2d5a27]"
              onClick={() => setEditando(true)}
            >
              <Pencil className="h-4 w-4" aria-hidden="true" />
              Editar
            </Boton>
          )}
        </div>

        {editando ? (
          <form onSubmit={handleGuardar} className="flex flex-col gap-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <CampoTexto
                id="perfil-nombre"
                label="Nombre"
                value={form.nombre}
                onChange={(e) => setCampo("nombre", e.target.value)}
                required
                autoFocus
              />
              <CampoTexto
                id="perfil-apellido"
                label="Apellido"
                value={form.apellido}
                onChange={(e) => setCampo("apellido", e.target.value)}
                required
              />
            </div>
            <CampoTexto
              id="perfil-telefono"
              label="Teléfono (opcional)"
              type="tel"
              value={form.telefono}
              onChange={(e) => setCampo("telefono", e.target.value)}
              placeholder="+54 261 555-0000"
            />
            <CampoTexto
              id="perfil-nacimiento"
              label="Fecha de nacimiento (opcional)"
              type="date"
              value={form.fecha_nacimiento}
              onChange={(e) => setCampo("fecha_nacimiento", e.target.value)}
            />
            {error && <Alerta variante="error">{error}</Alerta>}
            <div className="grid gap-2 sm:grid-cols-2">
              <Boton type="submit" cargando={loading}>
                {loading ? "Guardando..." : "Guardar cambios"}
              </Boton>
              <Boton type="button" variante="secundario" onClick={cancelar}>
                Cancelar
              </Boton>
            </div>
          </form>
        ) : (
          <div>
            <FilaDato
              label="Nombre"
              valor={`${empleado.nombre} ${empleado.apellido}`}
            />
            <FilaDato label="Email" valor={empleado.email} />
            <FilaDato label="Teléfono" valor={empleado.telefono || "-"} />
            <FilaDato
              label="Cumpleaños"
              valor={formatFecha(empleado.fecha_nacimiento) || "-"}
              last
            />
          </div>
        )}
      </Tarjeta>

      <Tarjeta className="mb-3 px-4 py-4">
        <TituloSeccion>Mi empresa</TituloSeccion>
        <FilaDato label="Empresa" valor={empleado.empresa?.nombre ?? "-"} />
        <FilaDato label="Plan" valor={plan} last />
      </Tarjeta>

      <Tarjeta className="mb-3 px-4 py-4">
        <div className="mb-3 flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-[#2d5a27]" aria-hidden="true" />
          <span className="block text-[0.72rem] font-black uppercase tracking-wide text-[#5f7f55]">
            Seguridad
          </span>
        </div>
        {showPass ? (
          <CambiarPasswordForm onCerrar={() => setShowPass(false)} />
        ) : (
          <Boton
            type="button"
            variante="secundario"
            anchoCompleto
            onClick={() => setShowPass(true)}
          >
            <LockKeyhole className="h-4 w-4" aria-hidden="true" />
            Cambiar contraseña
          </Boton>
        )}
      </Tarjeta>

      <Boton type="button" variante="peligro" anchoCompleto onClick={onLogout}>
        Cerrar sesión
      </Boton>

      <p className="mt-6 text-center text-xs font-bold text-[#d8d4cc]">
        La Quinta · Sistema de pedidos
      </p>
    </Pagina>
  );
}
