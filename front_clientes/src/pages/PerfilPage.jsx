import { useState } from 'react';
import { useQueryClient, useMutation } from '@tanstack/react-query';
import { ChevronRight, LogOut, Lock, Leaf, Wheat, Milk, Fish, TreeDeciduous, AlertCircle, CheckCircle2, MessageCircle } from 'lucide-react';
import { apiPatch } from '../services/apiCliente.js';
import { authApi } from '../services/api.js';
import BtnPrimary from '../components/ui/BtnPrimary.jsx';
import FloatField from '../components/ui/FloatField.jsx';

const PREFS = [
  { key: 'vegetariano',      label: 'Vegetariano',      Icon: Leaf },
  { key: 'sin_gluten',       label: 'Sin gluten',       Icon: Wheat },
  { key: 'sin_lacteos',      label: 'Sin lácteos',      Icon: Milk },
  { key: 'sin_pescado',      label: 'Sin pescado',      Icon: Fish },
  { key: 'sin_frutos_secos', label: 'Sin frutos secos', Icon: TreeDeciduous },
];

function Toggle({ active, onChange, disabled = false }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onChange}
      disabled={disabled}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-60 ${active ? 'bg-[#5B6B2A]' : 'bg-[#D8D5C8]'}`}
    >
      <span
        className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${active ? 'translate-x-6' : 'translate-x-1'}`}
      />
    </button>
  );
}

function FilaToggle({ label, sublabel, Icon, active, onChange, disabled }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3.5 border-b border-[#F0EDE6] last:border-0">
      <div className="w-8 h-8 bg-[#EDF0E4] rounded-xl flex items-center justify-center shrink-0">
        <Icon size={15} className="text-[#5B6B2A]" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-[#2A2C1F]">{label}</p>
        {sublabel && <p className="text-xs text-[#9A9885] mt-0.5">{sublabel}</p>}
      </div>
      <Toggle active={active} onChange={onChange} disabled={disabled} />
    </div>
  );
}

function SectionHeader({ title }) {
  return (
    <p className="px-4 text-xs font-bold text-[#9A9885] uppercase tracking-wider mt-6 mb-2">{title}</p>
  );
}

function formatFecha(fecha) {
  if (!fecha) return 'Sin cargar';
  const [year, month, day] = String(fecha).split('T')[0].split('-');
  if (!year || !month || !day) return 'Sin cargar';
  return `${day}/${month}/${year}`;
}

function FilaConfig({ label, sublabel, onPress, right }) {
  return (
    <button
      onClick={onPress}
      className="w-full flex items-center gap-3 bg-white px-4 py-4 border-b border-[#F0EDE6] last:border-0 text-left"
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-[#2A2C1F]">{label}</p>
        {sublabel && <p className="text-xs text-[#9A9885] mt-0.5">{sublabel}</p>}
      </div>
      {right || <ChevronRight size={16} className="text-[#C4C2B4] shrink-0" />}
    </button>
  );
}

// ── Cambiar contraseña ─────────────────────────────────────────────────────────
function CambiarPasswordSheet({ onClose }) {
  const [actual, setActual] = useState('');
  const [nueva, setNueva] = useState('');
  const [nueva2, setNueva2] = useState('');
  const [error, setError] = useState('');
  const [ok, setOk] = useState(false);
  const [loading, setLoading] = useState(false);

  const guardar = async () => {
    if (nueva !== nueva2) { setError('Las contraseñas no coinciden'); return; }
    if (nueva.length < 8) { setError('Mínimo 8 caracteres'); return; }
    setError('');
    setLoading(true);
    try {
      await authApi.cambiarPassword(actual, nueva);
      setOk(true);
    } catch (err) {
      setError(err?.message || 'No se pudo cambiar la contraseña');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/40">
      <div className="bg-[#FAF8F3] rounded-t-3xl px-5 pt-5 pb-10">
        <div className="w-10 h-1 bg-[#D8D5C8] rounded-full mx-auto mb-5" />
        <h2 className="text-base font-bold text-[#2A2C1F] font-serif mb-5">Cambiar contraseña</h2>

        {ok ? (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <CheckCircle2 size={36} className="text-[#5B6B2A]" />
            <p className="font-bold text-[#2A2C1F]">Contraseña actualizada</p>
            <BtnPrimary onClick={onClose} variant="secondary" size="sm">Listo</BtnPrimary>
          </div>
        ) : (
          <div className="space-y-4">
            {error && (
              <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5">
                <AlertCircle size={14} className="text-red-500 mt-0.5 shrink-0" />
                <p className="text-xs text-red-700">{error}</p>
              </div>
            )}
            <FloatField label="Contraseña actual"  type="password" value={actual} onChange={setActual} />
            <FloatField label="Nueva contraseña"   type="password" value={nueva}  onChange={setNueva} />
            <FloatField label="Repetir contraseña" type="password" value={nueva2} onChange={setNueva2} />
            <BtnPrimary onClick={guardar} loading={loading} className="w-full">Guardar</BtnPrimary>
            <BtnPrimary variant="ghost" onClick={onClose} className="w-full">Cancelar</BtnPrimary>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Página principal ───────────────────────────────────────────────────────────
export default function PerfilPage({ empleado, onLogout, onEmpleadoUpdate }) {
  const qc = useQueryClient();
  const [showPassword, setShowPassword] = useState(false);

  const prefs = empleado?.preferencias_alimentarias || {};
  const recibeRecordatoriosWhatsapp = Boolean(prefs.recibir_recordatorios_whatsapp);

  const prefsMutation = useMutation({
    mutationFn: (nuevasPrefs) => apiPatch('/auth/preferencias', nuevasPrefs),
    onSuccess: (data) => {
      if (onEmpleadoUpdate) onEmpleadoUpdate({ ...empleado, preferencias_alimentarias: data?.preferencias_alimentarias || data });
    },
  });

  const togglePref = (key, nextValue = undefined) => {
    const nuevas = { ...prefs, [key]: nextValue ?? !prefs[key] };
    prefsMutation.mutate(nuevas);
    // Optimistic update en UI
    if (onEmpleadoUpdate) onEmpleadoUpdate({ ...empleado, preferencias_alimentarias: nuevas });
  };

  const cerrarSesion = () => { qc.clear(); onLogout(); };

  const iniciales = [empleado?.nombre?.[0], empleado?.apellido?.[0]].filter(Boolean).join('').toUpperCase() || '?';
  const nombreCompleto = [empleado?.nombre, empleado?.apellido].filter(Boolean).join(' ') || 'Mi cuenta';

  return (
    <div className="flex flex-col h-full bg-[#FAF8F3]">
      {/* Header */}
      <div className="bg-[#5B6B2A] px-4 pt-12 pb-8">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center text-white text-xl font-bold font-serif">
            {iniciales}
          </div>
          <div>
            <p className="text-white text-lg font-bold font-serif">{nombreCompleto}</p>
            <p className="text-white/55 text-xs">{empleado?.email || ''}</p>
          </div>
        </div>
      </div>

      {/* Contenido */}
      <div className="flex-1 overflow-y-auto pb-24">
        {/* Datos personales */}
        <SectionHeader title="Mi cuenta" />
        <div className="mx-4 bg-white rounded-2xl border border-[#E8E5DC] overflow-hidden">
          <FilaConfig
            label="Empresa"
            sublabel={empleado?.empresa?.nombre || empleado?.empresa_nombre || '—'}
            right={<span />}
          />
          <FilaConfig
            label="Plan"
            sublabel={empleado?.empresa?.plan_detalle?.nombre || empleado?.empresa?.plan_nombre || empleado?.empresa?.plan || empleado?.plan || 'basico'}
            right={<span />}
          />
          <FilaConfig
            label="Teléfono"
            sublabel={empleado?.telefono || 'Sin cargar'}
            right={<span />}
          />
          <FilaConfig
            label="Cumpleaños"
            sublabel={formatFecha(empleado?.fecha_nacimiento)}
            right={<span />}
          />
        </div>

        {/* WhatsApp */}
        <SectionHeader title="WhatsApp" />
        <div className="mx-4 bg-white rounded-2xl border border-[#E8E5DC] overflow-hidden">
          <FilaToggle
            label="Recibir recordatorios"
            sublabel="Avisos al telÃ©fono cargado por WhatsApp"
            Icon={MessageCircle}
            active={recibeRecordatoriosWhatsapp}
            onChange={() => togglePref('recibir_recordatorios_whatsapp', !recibeRecordatoriosWhatsapp)}
            disabled={prefsMutation.isPending}
          />
        </div>

        {/* Preferencias alimentarias */}
        <SectionHeader title="Preferencias alimentarias" />
        <div className="mx-4 bg-white rounded-2xl border border-[#E8E5DC] overflow-hidden">
          {PREFS.map(({ key, label, Icon }) => (
            <FilaToggle
              key={key}
              label={label}
              Icon={Icon}
              active={Boolean(prefs[key])}
              onChange={() => togglePref(key)}
              disabled={prefsMutation.isPending}
            />
          ))}
        </div>

        {/* Seguridad */}
        <SectionHeader title="Seguridad" />
        <div className="mx-4 bg-white rounded-2xl border border-[#E8E5DC] overflow-hidden">
          <FilaConfig
            label="Cambiar contraseña"
            onPress={() => setShowPassword(true)}
            right={<Lock size={16} className="text-[#9A9885]" />}
          />
        </div>

        {/* Cerrar sesión */}
        <div className="mx-4 mt-5">
          <button
            onClick={cerrarSesion}
            className="w-full flex items-center justify-center gap-2 bg-red-50 border border-red-200 text-red-600 text-sm font-bold px-4 py-3.5 rounded-2xl"
          >
            <LogOut size={16} /> Cerrar sesión
          </button>
        </div>
      </div>

      {showPassword && <CambiarPasswordSheet onClose={() => setShowPassword(false)} />}
    </div>
  );
}
