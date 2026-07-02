import { useRef, useState } from "react";
import AuthLayout from "../compartido/layout/AuthLayout.jsx";
import Alerta from "../compartido/ui/Alerta.jsx";
import Boton from "../compartido/ui/Boton.jsx";
import CampoPassword from "../compartido/ui/CampoPassword.jsx";
import CampoTexto from "../compartido/ui/CampoTexto.jsx";
import Pasos from "../compartido/ui/Pasos.jsx";
import { authApi, saveClientSession } from "../services/api.js";

function slugify(str) {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
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

export default function RegistroScreen({ onRegistrado, onVolver }) {
  const [paso, setPaso] = useState(1);
  const [codigo, setCodigo] = useState("");
  const [empresa, setEmpresa] = useState(null);
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const codigoErrorId = errorCodigo ? "registro-codigo-error" : undefined;
  const registroErrorId = error ? "registro-form-error" : undefined;
  const codigoRef = useRef(null);

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

  const handleNombre = (value) => {
    setNombre(value);
    if (!emailManual) setEmail(emailSugerido(value, apellido, empresa?.nombre));
  };

  const handleApellido = (value) => {
    setApellido(value);
    if (!emailManual) setEmail(emailSugerido(nombre, value, empresa?.nombre));
  };

  const handleEmail = (value) => {
    setEmail(value);
    setEmailManual(true);
  };

  const handleRegistro = async (e) => {
    e.preventDefault();
    setError("");
    if (!nombre.trim() || !apellido.trim() || !email.trim() || !telefono.trim() || !nacimiento) {
      return setError("Completá todos los campos");
    }
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

  return (
    <AuthLayout subtitulo="Crear cuenta" className="max-w-[420px]">
      <div className="mb-6">
        <Pasos pasos={["Código", "Tus datos"]} pasoActual={paso} />
      </div>

      {paso === 1 && (
        <form
          onSubmit={handleCodigo}
          className="flex flex-col gap-3.5 text-left"
          aria-busy={loadingCodigo}
        >
          <p className="text-center text-sm leading-snug text-slate-500">
            Ingresá el código de tu empresa para continuar. Si no lo tenés,
            pedíselo al responsable de comedor o RR. HH.
          </p>

          <CampoTexto
            ref={codigoRef}
            id="registro-codigo"
            label="Código de empresa"
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
            inputClassName="text-center text-xl font-bold uppercase tracking-[0.18em]"
          />

          {errorCodigo && (
            <Alerta id="registro-codigo-error" variante="error">
              {errorCodigo}
            </Alerta>
          )}

          <Boton
            type="submit"
            anchoCompleto
            cargando={loadingCodigo}
            disabled={codigo.length < 4}
          >
            {loadingCodigo ? "Verificando..." : "Continuar →"}
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

      {paso === 2 && empresa && (
        <form
          onSubmit={handleRegistro}
          className="flex flex-col gap-3.5 text-left"
          aria-busy={loading}
        >
          <Alerta variante="exito">
            Empresa encontrada: <strong>{empresa.nombre}</strong>
          </Alerta>

          <div className="grid gap-3 sm:grid-cols-2">
            <CampoTexto
              id="registro-nombre"
              label="Nombre"
              value={nombre}
              onChange={(e) => handleNombre(e.target.value)}
              required
              autoFocus
              placeholder="Martín"
            />
            <CampoTexto
              id="registro-apellido"
              label="Apellido"
              value={apellido}
              onChange={(e) => handleApellido(e.target.value)}
              required
              placeholder="García"
            />
          </div>

          <CampoTexto
            id="registro-email"
            label="Email"
            type="email"
            value={email}
            onChange={(e) => handleEmail(e.target.value)}
            required
            placeholder="tu@email.com"
            autoComplete="username"
            inputMode="email"
            ayuda={!emailManual && email ? "Sugerido, podés cambiarlo" : null}
          />

          <CampoTexto
            id="registro-telefono"
            label="Teléfono"
            type="tel"
            value={telefono}
            onChange={(e) => setTelefono(e.target.value)}
            placeholder="+54 261 555-0000"
            inputMode="tel"
            required
          />

          <CampoTexto
            id="registro-nacimiento"
            label="Fecha de nacimiento"
            type="date"
            value={nacimiento}
            onChange={(e) => setNacimiento(e.target.value)}
            required
          />

          <CampoPassword
            id="registro-password"
            label="Contraseña"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            placeholder="Mínimo 8 caracteres"
            autoComplete="new-password"
            aria-invalid={!!error}
            aria-describedby={registroErrorId}
          />

          <CampoPassword
            id="registro-password-confirmacion"
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
            aria-describedby={registroErrorId}
          />

          {error && (
            <Alerta id="registro-form-error" variante="error">
              {error}
            </Alerta>
          )}

          <Boton type="submit" anchoCompleto cargando={loading}>
            {loading ? "Creando cuenta..." : "Crear mi cuenta"}
          </Boton>

          <Boton
            type="button"
            variante="fantasma"
            className="min-h-7 py-1 text-sm font-medium"
            onClick={() => setPaso(1)}
            anchoCompleto
          >
            Cambiar código de empresa
          </Boton>
        </form>
      )}
    </AuthLayout>
  );
}
