import { useState } from 'react';
import { Eye, EyeOff, ChevronLeft, AlertCircle, CheckCircle2, Lock } from 'lucide-react';
import { apiPost } from '../services/apiCliente.js';
import Logo from '../components/ui/Logo.jsx';
import BtnPrimary from '../components/ui/BtnPrimary.jsx';
import FloatField from '../components/ui/FloatField.jsx';

// ─── Recuperar contraseña ──────────────────────────────────────────────────────
function RecuperarScreen({ onVolver }) {
  const [email, setEmail] = useState('');
  const [enviado, setEnviado] = useState(false);
  const [loading, setLoading] = useState(false);

  const enviar = async () => {
    if (!email.trim()) return;
    setLoading(true);
    try {
      await apiPost('/auth/recuperar-password', { email: email.trim() });
    } catch {
      // siempre mostramos éxito para no revelar si el email existe
    } finally {
      setLoading(false);
      setEnviado(true);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#FAF8F3]">
      <div className="px-6 pt-14">
        <button
          onClick={onVolver}
          className="flex items-center gap-1 text-[#5B6B2A] mb-8 -ml-1"
        >
          <ChevronLeft size={20} />
          <span className="text-sm font-bold">Volver</span>
        </button>

        <div className="w-11 h-11 bg-[#EDF0E4] rounded-2xl flex items-center justify-center mb-5">
          <Lock size={20} className="text-[#5B6B2A]" />
        </div>

        <h1 className="text-[26px] font-bold text-[#2A2C1F] mb-2 leading-tight font-serif">
          Recuperar contraseña
        </h1>
        <p className="text-[#7A7868] text-sm mb-8 leading-relaxed">
          Ingresá tu email y te enviamos un enlace para restablecer tu contraseña.
        </p>

        {!enviado ? (
          <div className="space-y-5">
            <FloatField
              label="Email"
              type="email"
              value={email}
              onChange={setEmail}
            />
            <BtnPrimary onClick={enviar} loading={loading} className="w-full">
              Enviar enlace
            </BtnPrimary>
          </div>
        ) : (
          <div className="flex flex-col items-center text-center pt-4 gap-4">
            <div className="w-14 h-14 bg-[#EDF0E4] rounded-full flex items-center justify-center">
              <CheckCircle2 size={28} className="text-[#5B6B2A]" />
            </div>
            <p className="text-base font-bold text-[#2A2C1F]">¡Enlace enviado!</p>
            <p className="text-sm text-[#7A7868]">
              Si tu email está registrado, vas a recibir las instrucciones.
            </p>
            <BtnPrimary variant="secondary" onClick={onVolver} size="sm">
              Volver al inicio
            </BtnPrimary>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Registro ──────────────────────────────────────────────────────────────────
function RegistroScreen({ onVolver, onRegistrado }) {
  const [form, setForm] = useState({ codigo: '', nombre: '', apellido: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const set = (k) => (v) => setForm((p) => ({ ...p, [k]: v }));

  const registrar = async () => {
    if (!form.codigo || !form.nombre || !form.apellido || !form.email || !form.password) {
      setError('Completá todos los campos.');
      return;
    }
    if (form.password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const data = await apiPost('/auth/registro', form);
      onRegistrado(data);
    } catch (err) {
      setError(err?.message || 'No se pudo crear la cuenta. Revisá el código de empresa.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#FAF8F3] overflow-y-auto">
      <div className="px-6 pt-14 pb-10">
        <button
          onClick={onVolver}
          className="flex items-center gap-1 text-[#5B6B2A] mb-8 -ml-1"
        >
          <ChevronLeft size={20} />
          <span className="text-sm font-bold">Volver</span>
        </button>

        <h1 className="text-[26px] font-bold text-[#2A2C1F] mb-1 leading-tight font-serif">
          Crear cuenta
        </h1>
        <p className="text-[#7A7868] text-sm mb-8">Completá tus datos para comenzar.</p>

        {error && (
          <div className="flex items-start gap-2.5 bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-5">
            <AlertCircle size={15} className="text-red-500 mt-0.5 shrink-0" />
            <p className="text-sm text-red-700 leading-snug">{error}</p>
          </div>
        )}

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <FloatField label="Nombre"   value={form.nombre}   onChange={set('nombre')} />
            <FloatField label="Apellido" value={form.apellido} onChange={set('apellido')} />
          </div>
          <FloatField label="Email laboral" type="email"    value={form.email}    onChange={set('email')} />
          <FloatField label="Contraseña"    type="password" value={form.password} onChange={set('password')} />
          <FloatField label="Código de empresa" value={form.codigo} onChange={set('codigo')} />
          <p className="text-xs text-[#9A9885] leading-relaxed">
            El código de empresa te lo proporciona tu administrador.
          </p>
          <BtnPrimary onClick={registrar} loading={loading} className="w-full mt-2">
            Crear cuenta
          </BtnPrimary>
        </div>
      </div>
    </div>
  );
}

// ─── Login principal ───────────────────────────────────────────────────────────
export default function LoginPage({ onLogin }) {
  const [sub, setSub] = useState('login'); // 'login' | 'forgot' | 'register'
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);

  const doLogin = async () => {
    if (!email)    { setError('Ingresá tu email.');       return; }
    if (!password) { setError('Ingresá tu contraseña.'); return; }
    setError('');
    setLoading(true);
    try {
      await onLogin(email.trim(), password, remember);
    } catch (err) {
      setError(err?.message || 'Email o contraseña incorrectos.');
    } finally {
      setLoading(false);
    }
  };

  if (sub === 'forgot') {
    return <RecuperarScreen onVolver={() => setSub('login')} />;
  }

  if (sub === 'register') {
    return (
      <RegistroScreen
        onVolver={() => setSub('login')}
        onRegistrado={(data) => onLogin(null, null, false, data)}
      />
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header verde */}
      <div
        className="relative overflow-hidden bg-[#5B6B2A] px-6 pt-16 pb-14 flex-shrink-0"
        style={{ borderRadius: '0 0 40px 40px' }}
      >
        <svg className="absolute -right-2 -top-2 opacity-[0.07]" width="210" height="190" viewBox="0 0 210 190" fill="white">
          <path d="M125 8 C148 -8 192 18 198 58 C204 98 175 132 135 136 C95 140 62 112 68 80 C74 52 98 28 125 8Z" />
          <path d="M165 48 C182 36 208 52 212 76 C216 100 196 120 174 118 C156 116 146 100 158 84 C163 74 164 62 165 48Z" />
        </svg>
        <div className="relative z-10 flex items-center gap-3 mb-3">
          <Logo size={30} className="text-white" />
          <span className="text-[22px] font-bold text-white tracking-tight font-serif">La Quinta</span>
        </div>
        <p className="relative z-10 text-white/55 text-[13px]">Viandas para el trabajo</p>
      </div>

      {/* Formulario */}
      <div className="flex-1 bg-[#FAF8F3] px-6 pt-8 pb-8 overflow-y-auto">
        <h2 className="text-[22px] font-bold text-[#2A2C1F] mb-7 font-serif">Iniciar sesión</h2>

        {error && (
          <div className="flex items-start gap-2.5 bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-5">
            <AlertCircle size={15} className="text-red-500 mt-0.5 shrink-0" />
            <p className="text-sm text-red-700 leading-snug">{error}</p>
          </div>
        )}

        <div className="space-y-4">
          <FloatField
            label="Email"
            type="email"
            value={email}
            onChange={setEmail}
            autoFocus
          />
          <FloatField
            label="Contraseña"
            type={showPass ? 'text' : 'password'}
            value={password}
            onChange={setPassword}
            right={
              <button
                onClick={() => setShowPass(v => !v)}
                className="text-[#9A9885] p-1"
                type="button"
              >
                {showPass ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            }
          />

          <div className="flex items-center justify-between pt-0.5">
            <label
              className="flex items-center gap-2 cursor-pointer"
              onClick={() => setRemember(v => !v)}
            >
              <div className={`w-5 h-5 rounded-md border-2 transition-colors flex items-center justify-center ${remember ? 'bg-[#5B6B2A] border-[#5B6B2A]' : 'border-[#D8D5C8] bg-white'}`}>
                {remember && <CheckCircle2 size={11} className="text-white" strokeWidth={3} />}
              </div>
              <span className="text-sm text-[#2A2C1F]">Recordarme</span>
            </label>
            <button
              onClick={() => setSub('forgot')}
              className="text-sm text-[#5B6B2A] font-bold"
              type="button"
            >
              ¿Olvidaste tu contraseña?
            </button>
          </div>

          <BtnPrimary onClick={doLogin} loading={loading} className="w-full mt-1">
            Iniciar sesión
          </BtnPrimary>

          <div className="flex items-center gap-3 py-1">
            <div className="flex-1 h-px bg-[#E8E5DC]" />
            <span className="text-xs text-[#C4C2B4]">o</span>
            <div className="flex-1 h-px bg-[#E8E5DC]" />
          </div>

          <BtnPrimary variant="secondary" onClick={() => setSub('register')} className="w-full">
            Crear una cuenta nueva
          </BtnPrimary>
        </div>
      </div>
    </div>
  );
}
