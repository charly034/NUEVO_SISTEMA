import { useNavigate } from "react-router-dom";
import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  Eye,
  EyeOff,
  Lock,
} from "lucide-react";
import {
  useLoginForm,
  useRecuperarPasswordForm,
  useRegistroForm,
  VISTAS_AUTENTICACION,
} from "../hooks/useLoginPage.js";
import Logo from "../components/ui/Logo.jsx";
import BtnPrimary from "../components/ui/BtnPrimary.jsx";
import FloatField from "../components/ui/FloatField.jsx";
import { rutasAutenticacion } from "../routes/rutasCliente.js";

function AuthAlert({ children }) {
  if (!children) return null;

  return (
    <div className="mb-5 flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
      <AlertCircle size={15} className="mt-0.5 shrink-0 text-red-500" />
      <p className="text-sm leading-snug text-red-700">{children}</p>
    </div>
  );
}

function VolverButton({ onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="-ml-1 mb-8 flex items-center gap-1 text-[#5B6B2A]"
    >
      <ChevronLeft size={20} />
      <span className="text-sm font-bold">Volver</span>
    </button>
  );
}

function AuthHeader() {
  return (
    <div
      className="relative shrink-0 overflow-hidden bg-[#5B6B2A] px-6 pb-14 pt-16"
      style={{ borderRadius: "0 0 40px 40px" }}
    >
      <svg
        className="absolute -right-2 -top-2 opacity-[0.07]"
        width="210"
        height="190"
        viewBox="0 0 210 190"
        fill="white"
        aria-hidden="true"
      >
        <path d="M125 8 C148 -8 192 18 198 58 C204 98 175 132 135 136 C95 140 62 112 68 80 C74 52 98 28 125 8Z" />
        <path d="M165 48 C182 36 208 52 212 76 C216 100 196 120 174 118 C156 116 146 100 158 84 C163 74 164 62 165 48Z" />
      </svg>

      <div className="relative z-10 mb-3 flex items-center gap-3">
        <Logo size={30} className="text-white" />
        <span className="font-serif text-[22px] font-bold tracking-tight text-white">
          La Quinta
        </span>
      </div>
      <p className="relative z-10 text-[13px] text-white/55">
        Viandas para el trabajo
      </p>
    </div>
  );
}

function Separador() {
  return (
    <div className="flex items-center gap-3 py-1">
      <div className="h-px flex-1 bg-[#E8E5DC]" />
      <span className="text-xs text-[#C4C2B4]">o</span>
      <div className="h-px flex-1 bg-[#E8E5DC]" />
    </div>
  );
}

function PasswordToggle({ activo, onToggle }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="p-1 text-[#9A9885]"
      aria-label={activo ? "Ocultar contrasena" : "Mostrar contrasena"}
    >
      {activo ? <EyeOff size={17} /> : <Eye size={17} />}
    </button>
  );
}

function RecordarmeCheckbox({ activo, onToggle }) {
  return (
    <label className="flex cursor-pointer items-center gap-2">
      <input
        type="checkbox"
        className="sr-only"
        checked={activo}
        onChange={onToggle}
      />
      <span
        className={[
          "flex h-5 w-5 items-center justify-center rounded-md border-2 transition-colors",
          activo ? "border-[#5B6B2A] bg-[#5B6B2A]" : "border-[#D8D5C8] bg-white",
        ].join(" ")}
        aria-hidden="true"
      >
        {activo && <CheckCircle2 size={11} className="text-white" strokeWidth={3} />}
      </span>
      <span className="text-sm text-[#2A2C1F]">Recordarme</span>
    </label>
  );
}

function LoginScreen({ onCambiarVista, onLogin }) {
  const login = useLoginForm(onLogin);
  const { formulario } = login;

  return (
    <div className="flex h-full flex-col">
      <AuthHeader />

      <main className="flex-1 overflow-y-auto bg-[#FAF8F3] px-6 pb-8 pt-8">
        <h1 className="mb-7 font-serif text-[22px] font-bold text-[#2A2C1F]">
          Iniciar sesion
        </h1>

        <AuthAlert>{login.error}</AuthAlert>

        <form className="space-y-4" onSubmit={login.enviar}>
          <FloatField
            label="Email"
            type="email"
            value={formulario.email}
            onChange={(valor) => login.actualizarCampo("email", valor)}
            autoFocus
          />
          <FloatField
            label="Contrasena"
            type={formulario.mostrarPassword ? "text" : "password"}
            value={formulario.password}
            onChange={(valor) => login.actualizarCampo("password", valor)}
            right={
              <PasswordToggle
                activo={formulario.mostrarPassword}
                onToggle={login.alternarPasswordVisible}
              />
            }
          />

          <div className="flex items-center justify-between pt-0.5">
            <RecordarmeCheckbox
              activo={formulario.recordarSesion}
              onToggle={login.alternarRecordarSesion}
            />
            <button
              type="button"
              onClick={() => onCambiarVista(VISTAS_AUTENTICACION.RECUPERAR)}
              className="text-sm font-bold text-[#5B6B2A]"
            >
              Olvidaste tu contrasena?
            </button>
          </div>

          <BtnPrimary type="submit" loading={login.cargando} className="mt-1 w-full">
            Iniciar sesion
          </BtnPrimary>

          <Separador />

          <BtnPrimary
            type="button"
            variant="secondary"
            onClick={() => onCambiarVista(VISTAS_AUTENTICACION.REGISTRO)}
            className="w-full"
          >
            Crear una cuenta nueva
          </BtnPrimary>
        </form>
      </main>
    </div>
  );
}

function RegistroScreen({ onRegistroExitoso, onVolver }) {
  const registro = useRegistroForm(onRegistroExitoso);
  const { formulario } = registro;

  return (
    <main className="h-full overflow-y-auto bg-[#FAF8F3] px-6 pb-10 pt-14">
      <VolverButton onClick={onVolver} />

      <h1 className="mb-1 font-serif text-[26px] font-bold leading-tight text-[#2A2C1F]">
        Crear cuenta
      </h1>
      <p className="mb-8 text-sm text-[#7A7868]">
        Completa tus datos para comenzar.
      </p>

      <AuthAlert>{registro.error}</AuthAlert>

      <form className="space-y-4" onSubmit={registro.enviar}>
        <div className="grid grid-cols-2 gap-3">
          <FloatField
            label="Nombre"
            value={formulario.nombre}
            onChange={(valor) => registro.actualizarCampo("nombre", valor)}
          />
          <FloatField
            label="Apellido"
            value={formulario.apellido}
            onChange={(valor) => registro.actualizarCampo("apellido", valor)}
          />
        </div>
        <FloatField
          label="Email laboral"
          type="email"
          value={formulario.email}
          onChange={(valor) => registro.actualizarCampo("email", valor)}
        />
        <FloatField
          label="Telefono"
          type="tel"
          value={formulario.telefono}
          onChange={(valor) => registro.actualizarCampo("telefono", valor)}
        />
        <FloatField
          label="Cumpleanos"
          type="date"
          value={formulario.fecha_nacimiento}
          onChange={(valor) => registro.actualizarCampo("fecha_nacimiento", valor)}
        />
        <FloatField
          label="Contrasena"
          type="password"
          value={formulario.password}
          onChange={(valor) => registro.actualizarCampo("password", valor)}
        />
        <FloatField
          label="Codigo de empresa"
          value={formulario.codigo}
          onChange={(valor) => registro.actualizarCampo("codigo", valor)}
        />
        <p className="text-xs leading-relaxed text-[#9A9885]">
          El codigo de empresa te lo proporciona tu administrador.
        </p>
        <BtnPrimary type="submit" loading={registro.cargando} className="mt-2 w-full">
          Crear cuenta
        </BtnPrimary>
      </form>
    </main>
  );
}

function RecuperarScreen({ onVolver }) {
  const recuperacion = useRecuperarPasswordForm();
  const { formulario } = recuperacion;

  return (
    <main className="h-full overflow-y-auto bg-[#FAF8F3] px-6 pt-14">
      <VolverButton onClick={onVolver} />

      <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-2xl bg-[#EDF0E4]">
        <Lock size={20} className="text-[#5B6B2A]" />
      </div>

      <h1 className="mb-2 font-serif text-[26px] font-bold leading-tight text-[#2A2C1F]">
        Recuperar contrasena
      </h1>
      <p className="mb-8 text-sm leading-relaxed text-[#7A7868]">
        Pedi un codigo de recuperacion a tu empresa y elegi una nueva contrasena.
      </p>

      {recuperacion.completado ? (
        <div className="flex flex-col items-center gap-4 pt-4 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#EDF0E4]">
            <CheckCircle2 size={28} className="text-[#5B6B2A]" />
          </div>
          <p className="text-base font-bold text-[#2A2C1F]">Contrasena actualizada</p>
          <p className="text-sm text-[#7A7868]">
            Ya podes iniciar sesion con tu nueva contrasena.
          </p>
          <BtnPrimary variant="secondary" onClick={onVolver} size="sm">
            Volver al inicio
          </BtnPrimary>
        </div>
      ) : (
        <form className="space-y-4" onSubmit={recuperacion.enviar}>
          <AuthAlert>{recuperacion.error}</AuthAlert>
          <FloatField
            label="Codigo de recuperacion"
            value={formulario.codigo}
            onChange={(valor) => recuperacion.actualizarCampo("codigo", valor.toUpperCase())}
            autoFocus
          />
          <FloatField
            label="Nueva contrasena"
            type="password"
            value={formulario.password}
            onChange={(valor) => recuperacion.actualizarCampo("password", valor)}
          />
          <FloatField
            label="Confirmar contrasena"
            type="password"
            value={formulario.confirmacion}
            onChange={(valor) => recuperacion.actualizarCampo("confirmacion", valor)}
          />
          <BtnPrimary type="submit" loading={recuperacion.cargando} className="w-full">
            Guardar nueva contrasena
          </BtnPrimary>
        </form>
      )}
    </main>
  );
}

function rutaParaVista(vista) {
  if (vista === VISTAS_AUTENTICACION.REGISTRO) {
    return rutasAutenticacion.crearCuenta;
  }

  if (vista === VISTAS_AUTENTICACION.RECUPERAR) {
    return rutasAutenticacion.recuperarAcceso;
  }

  return rutasAutenticacion.iniciarSesion;
}

export default function LoginPage({
  onLogin,
  onSesionAutenticada,
  vistaInicial = VISTAS_AUTENTICACION.LOGIN,
}) {
  const navigate = useNavigate();
  const vista = vistaInicial;

  const cambiarVista = (nuevaVista) => {
    navigate(rutaParaVista(nuevaVista));
  };

  const volverAlLogin = () => cambiarVista(VISTAS_AUTENTICACION.LOGIN);

  if (vista === VISTAS_AUTENTICACION.RECUPERAR) {
    return <RecuperarScreen onVolver={volverAlLogin} />;
  }

  if (vista === VISTAS_AUTENTICACION.REGISTRO) {
    return (
      <RegistroScreen
        onVolver={volverAlLogin}
        onRegistroExitoso={onSesionAutenticada}
      />
    );
  }

  return (
    <LoginScreen
      onLogin={onLogin}
      onCambiarVista={cambiarVista}
    />
  );
}
