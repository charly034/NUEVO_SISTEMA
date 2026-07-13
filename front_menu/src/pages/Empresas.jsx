import { useEffect, useRef, useState } from 'react';
import { getDependenciasEmpresa, useEmpresas, useCreateEmpresa, useUpdateEmpresa, useDeleteEmpresa, useReopenPlazo, useClearOverride, useRegenerarCodigo } from '../hooks/useEmpresas.js';
import { useEmpleados, useCreateEmpleado, useUpdateEmpleado, useDeleteEmpleado, useGenerarResetCode, useImportarEmpleados } from '../hooks/useEmpleados.js';
import { usePlanes } from '../hooks/usePlanes.js';
import { useDebounce } from '../hooks/useDebounce.js';
import { confirmar } from '../lib/confirm.js';
import { toast } from '../lib/toast.js';
import { adminAuth } from '../auth.js';
import CuentaCorrienteFicha from '../components/finanzas/CuentaCorrienteFicha.jsx';
import SideDrawer from '../components/ui/SideDrawer.jsx';
import { DIAS_LABORALES as DIAS_SEMANA, DIA_NOMBRE as DIAS_LABEL } from '../lib/dias.js';
import { formatFechaCorta as formatearFechaCorta } from '../lib/fechas.js';

function normalizarFechaInput(fecha) {
  return fecha ? String(fecha).split('T')[0] : '';
}

const PLANES = { basico: 'Básico', con_postre: 'Con postre', con_postre_bebida: 'Con postre y bebida' };
const MODOS = { semanal: 'Semanal', diario: 'Diario', ambos: 'Ambos' };
const DIAS_LAB = { lunes_viernes: 'Lunes a viernes', lunes_sabado: 'Lunes a sábado', lunes_domingo: 'Lunes a domingo' };
const OPCION_DEFAULT = { '': 'Todas las opciones', A: 'Opción 1', B: 'Opción 2', C: 'Opción 3', D: 'Opción 4', E: 'Opción 5' };

function etiquetaPlan(plan) {
  if (!plan) return 'Sin plan';
  const rango = plan.gramaje_max ? `${plan.gramaje_min}-${plan.gramaje_max} g` : `${plan.gramaje_min} g`;
  const extras = [
    plan.incluye_postre ? 'postre' : null,
    plan.incluye_bebida ? 'bebida' : null,
  ].filter(Boolean).join(' + ');
  return `${plan.nombre} · ${rango}${extras ? ` · ${extras}` : ''}`;
}

function generarSlug(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const iconButtonClass = 'inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500 transition-colors hover:bg-gray-50 hover:text-gray-900';
const dangerIconButtonClass = 'inline-flex h-8 w-8 items-center justify-center rounded-lg border border-red-100 bg-white text-red-500 transition-colors hover:bg-red-50 hover:text-red-700';

function CuentaCorrienteIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4" aria-hidden="true">
      <path d="M4 7h16a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h13" />
      <path d="M16 13h4" />
      <path d="M6 9h6" />
    </svg>
  );
}

function EditarIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4" aria-hidden="true">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5Z" />
    </svg>
  );
}

function EliminarIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4" aria-hidden="true">
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="M19 6l-1 14H6L5 6" />
      <path d="M10 11v5M14 11v5" />
    </svg>
  );
}

function LlaveIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4" aria-hidden="true">
      <circle cx="8" cy="15" r="4" />
      <path d="M11 12l8-8" />
      <path d="M16 4h3v3" />
      <path d="M14 6l4 4" />
    </svg>
  );
}

function ReabrirPlazoIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4" aria-hidden="true">
      <path d="M8 2v4M16 2v4" />
      <rect x="3" y="4" width="18" height="17" rx="2" />
      <path d="M3 10h18" />
      <circle cx="16" cy="16" r="3" />
      <path d="M16 14.5V16l1 1" />
    </svg>
  );
}

export default function Empresas() {
  const adminUser = adminAuth.storedUser();
  const esSuperAdmin = adminUser?.rol === 'superadmin';
  const [busquedaEmpresa, setBusquedaEmpresa] = useState('');
  const [estadoFiltro, setEstadoFiltro] = useState('todas');
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const busquedaDebounced = useDebounce(busquedaEmpresa, 300);
  const { data: empresasResponse, isLoading } = useEmpresas({
    page,
    pageSize,
    search: busquedaDebounced,
    estado: estadoFiltro,
  });
  const { data: planes = [] } = usePlanes();
  const createEmpresa = useCreateEmpresa();
  const updateEmpresa = useUpdateEmpresa();
  const deleteEmpresa = useDeleteEmpresa();
  const reopenPlazo = useReopenPlazo();
  const clearOverride = useClearOverride();
  const regenerarCodigo = useRegenerarCodigo();

  const [empresaActiva, setEmpresaActiva] = useState(null);
  const [modalEmpresa, setModalEmpresa] = useState(null); // null | 'nueva' | empresa
const [modalPlazo, setModalPlazo] = useState(null); // empresa | null
  const [modalEliminar, setModalEliminar] = useState(null);
  const [cuentaCorriente, setCuentaCorriente] = useState(null);
  const empresas = empresasResponse?.data || [];
  const totalEmpresas = empresasResponse?.total || 0;
  const totalPages = Math.max(1, Math.ceil(totalEmpresas / pageSize));
  const hayBusquedaEmpresa = busquedaDebounced.trim().length > 0;
  const textoCantidadEmpresas = `${totalEmpresas} empresa${totalEmpresas !== 1 ? 's' : ''}`;

  const handleGuardarEmpresa = async (form) => {
    try {
      if (form.id) {
        await updateEmpresa.mutateAsync({ id: form.id, data: form });
        toast.success('Empresa actualizada');
      } else {
        await createEmpresa.mutateAsync(form);
        toast.success('Empresa creada');
      }
      setModalEmpresa(null);
    } catch (e) {
      toast.error(e?.message || 'Error al guardar');
    }
  };

  const handleEliminarEmpresa = async (e) => {
    try {
      await deleteEmpresa.mutateAsync(e.id);
      if (empresaActiva?.id === e.id) setEmpresaActiva(null);
      toast.success('Empresa eliminada');
      setModalEliminar(null);
    } catch (err) {
      toast.error(err?.message || 'Error al eliminar');
    }
  };

  if (isLoading) return <p className="p-6 text-gray-500">Cargando...</p>;

  return (
    <div className="mx-auto max-w-7xl min-w-0 p-4 md:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Empresas</h1>
          <p className="text-sm text-gray-500">{textoCantidadEmpresas}</p>
        </div>
        <button onClick={() => setModalEmpresa('nueva')} className="self-start bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-green-800">
          + Nueva empresa
        </button>
      </div>

      {/* Barra de búsqueda + filtros */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          value={busquedaEmpresa}
          onChange={(event) => { setBusquedaEmpresa(event.target.value); setPage(1); }}
          placeholder="Nombre, @slug o email de contacto..."
          className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm focus:border-green-500 focus:outline-none sm:max-w-sm"
        />
        <EstadoFiltroChips value={estadoFiltro} onChange={(value) => { setEstadoFiltro(value); setPage(1); }} />
      </div>

      {/* Tabla compacta */}
      <div className="rounded-xl border border-gray-100 bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wide">
              <th className="px-4 py-3 text-left">Empresa</th>
              <th className="px-4 py-3 text-left hidden sm:table-cell">Plan</th>
              <th className="px-4 py-3 text-left hidden md:table-cell">Modo</th>
              <th className="px-4 py-3 text-left">Estado</th>
              <th className="px-4 py-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {empresas.map(e => (
              <tr
                key={e.id}
                onClick={() => setEmpresaActiva(e)}
                className="cursor-pointer hover:bg-gray-50 transition-colors"
              >
                <td className="px-4 py-3">
                  <p className="font-semibold text-gray-900">{e.nombre}</p>
                  <p className="text-xs text-gray-500">@{e.slug}</p>
                </td>
                <td className="px-4 py-3 hidden sm:table-cell text-gray-600">
                  {e.plan_nombre || PLANES[e.plan] || '—'}
                </td>
                <td className="px-4 py-3 hidden md:table-cell text-gray-500 text-xs">
                  {MODOS[e.modo_pedido] || '—'}
                </td>
                <td className="px-4 py-3">
                  <EstadoEmpresaBadge activa={e.activo} />
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    type="button"
                    onClick={(ev) => { ev.stopPropagation(); setModalEmpresa(e); }}
                    className={iconButtonClass}
                    aria-label={`Editar ${e.nombre}`}
                    title="Editar empresa"
                  >
                    <EditarIcon />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {empresas.length === 0 && (
          <div className="px-4 py-10 text-center">
            <p className="text-sm font-semibold text-gray-700">
              {hayBusquedaEmpresa ? `No se encontraron empresas para "${busquedaEmpresa.trim()}"` : 'Todavía no hay empresas cargadas.'}
            </p>
            {hayBusquedaEmpresa && <p className="mt-1 text-xs text-gray-500">Probá con otro nombre, slug o email.</p>}
          </div>
        )}
      </div>
      <div className="mt-3">
        <Pagination page={page} totalPages={totalPages} onChange={setPage} />
      </div>

      {/* SideDrawer: detalle empresa + empleados */}
      <SideDrawer
        open={Boolean(empresaActiva)}
        onClose={() => setEmpresaActiva(null)}
        title={empresaActiva?.nombre || ''}
        width="lg"
      >
        {empresaActiva && (
          <div className="p-5 space-y-6">
            {/* Datos de la empresa */}
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <EstadoEmpresaBadge activa={empresaActiva.activo} />
                <span className="text-xs text-gray-500">@{empresaActiva.slug}</span>
              </div>
              <p className="text-sm text-gray-600">
                {empresaActiva.plan_nombre || PLANES[empresaActiva.plan] || 'Sin plan'} · {MODOS[empresaActiva.modo_pedido]}
              </p>
              {empresaActiva.limite_hora && (
                <p className="text-xs text-amber-600">
                  {empresaActiva.modo_pedido === 'semanal'
                    ? `Límite: ${empresaActiva.limite_dia_semana || 'lunes'} ${empresaActiva.limite_hora}hs`
                    : empresaActiva.limite_anticipacion_dias > 0
                      ? `Límite: día anterior ${empresaActiva.limite_hora}hs`
                      : `Límite: mismo día ${empresaActiva.limite_hora}hs`}
                </p>
              )}
              {empresaActiva.plazo_override_hasta && new Date() <= new Date(empresaActiva.plazo_override_hasta) && (
                <p className="text-xs font-medium text-green-700">
                  Plazo reabierto hasta {new Date(empresaActiva.plazo_override_hasta).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}hs
                </p>
              )}
            </div>

            {/* Código de registro */}
            <CodigoBadge
              empresa={empresaActiva}
              esSuperAdmin={esSuperAdmin}
              puedeReabrir={empresaActiva.limite_hora || empresaActiva.modo_pedido === 'semanal' || empresaActiva.modo_pedido === 'ambos'}
              onRegenerarCodigo={() => regenerarCodigo.mutate(empresaActiva.id, { onSuccess: () => toast.success('Código regenerado') })}
              onReabrirPlazo={() => setModalPlazo(empresaActiva)}
            />

            {/* Botones de acción */}
            <div className="flex flex-wrap gap-2 pt-1 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setModalEmpresa(empresaActiva)}
                className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                <EditarIcon /> Editar empresa
              </button>
              <button
                type="button"
                onClick={() => setCuentaCorriente({ tipo: 'empresa', id: empresaActiva.id, nombre: empresaActiva.nombre })}
                className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                <CuentaCorrienteIcon /> Cuenta corriente
              </button>
              {(empresaActiva.limite_hora || empresaActiva.modo_pedido === 'semanal' || empresaActiva.modo_pedido === 'ambos') && (
                <button
                  type="button"
                  onClick={() => setModalPlazo(empresaActiva)}
                  className="flex items-center gap-1.5 rounded-lg border border-amber-200 px-3 py-1.5 text-sm font-semibold text-amber-700 hover:bg-amber-50"
                >
                  Reabrir plazo
                </button>
              )}
              {esSuperAdmin && (
                <button
                  type="button"
                  onClick={() => setModalEliminar(empresaActiva)}
                  className="flex items-center gap-1.5 rounded-lg border border-red-100 px-3 py-1.5 text-sm font-semibold text-red-600 hover:bg-red-50 ml-auto"
                >
                  <EliminarIcon /> Eliminar
                </button>
              )}
            </div>

            {/* Empleados */}
            <EmpleadosPanel
              empresa={empresaActiva}
              esSuperAdmin={esSuperAdmin}
              onAbrirCuenta={(empleado) => setCuentaCorriente({
                tipo: 'empleado',
                id: empleado.id,
                nombre: `${empleado.nombre || ''} ${empleado.apellido || ''}`.trim() || empleado.email,
              })}
            />
          </div>
        )}
      </SideDrawer>

      {/* Modal empresa */}
      {modalEmpresa && (
        <ModalEmpresa
          empresa={modalEmpresa === 'nueva' ? null : modalEmpresa}
          planes={planes}
          onGuardar={handleGuardarEmpresa}
          onCerrar={() => setModalEmpresa(null)}
          loading={createEmpresa.isPending || updateEmpresa.isPending}
        />
      )}

      {/* Modal reabrir plazo */}
      {modalPlazo && (
        <ModalReopenPlazo
          empresa={modalPlazo}
          onReabrir={async (horas) => {
            try {
              await reopenPlazo.mutateAsync({ id: modalPlazo.id, horas });
              toast.success(`Plazo reabierto por ${horas}h`);
              setModalPlazo(null);
            } catch (e) { toast.error(e?.message || 'Error'); }
          }}
          onCerrarOverride={async () => {
            try {
              await clearOverride.mutateAsync(modalPlazo.id);
              toast.success('Override de plazo eliminado');
              setModalPlazo(null);
            } catch (e) { toast.error(e?.message || 'Error'); }
          }}
          onCerrar={() => setModalPlazo(null)}
          loading={reopenPlazo.isPending || clearOverride.isPending}
        />
      )}

      {modalEliminar && (
        <ConfirmDeleteModal
          key={modalEliminar.id}
          empresa={modalEliminar}
          onCerrar={() => setModalEliminar(null)}
          onConfirmar={() => handleEliminarEmpresa(modalEliminar)}
          loading={deleteEmpresa.isPending}
        />
      )}

      {cuentaCorriente && (
        <CuentaCorrienteFicha
          tipo={cuentaCorriente.tipo}
          id={cuentaCorriente.id}
          nombre={cuentaCorriente.nombre}
          onClose={() => setCuentaCorriente(null)}
        />
      )}

    </div>
  );
}

function EstadoFiltroChips({ value, onChange }) {
  const opciones = [
    ['todas', 'Todas'],
    ['activa', 'Activas'],
    ['inactiva', 'Inactivas'],
  ];

  return (
    <div className="flex flex-wrap gap-2">
      {opciones.map(([id, label]) => (
        <button
          key={id}
          type="button"
          onClick={() => onChange(id)}
          className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
            value === id
              ? 'border-green-700 bg-green-700 text-white'
              : 'border-gray-200 bg-white text-gray-600 hover:border-green-200 hover:text-green-800'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function Pagination({ page, totalPages, onChange }) {
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-gray-100 bg-white px-3 py-2">
      <button
        type="button"
        disabled={page <= 1}
        onClick={() => onChange(Math.max(1, page - 1))}
        className="rounded-md border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600 disabled:cursor-not-allowed disabled:opacity-40"
      >
        Anterior
      </button>
      <span className="text-xs font-semibold text-gray-500">Página {page} de {totalPages}</span>
      <button
        type="button"
        disabled={page >= totalPages}
        onClick={() => onChange(Math.min(totalPages, page + 1))}
        className="rounded-md border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600 disabled:cursor-not-allowed disabled:opacity-40"
      >
        Siguiente
      </button>
    </div>
  );
}

function EstadoEmpresaBadge({ activa }) {
  return (
    <span className={`rounded-full border px-2 py-0.5 text-[11px] font-bold ${
      activa
        ? 'border-green-200 bg-green-100 text-green-800'
        : 'border-red-100 bg-red-50 text-red-700'
    }`}
    >
      {activa ? 'Activa' : 'Inactiva'}
    </span>
  );
}

function CodigoBadge({ empresa, esSuperAdmin, puedeReabrir, onRegenerarCodigo, onReabrirPlazo }) {
  const [abierto, setAbierto] = useState(false);

  const copiarCodigo = async () => {
    if (!empresa.codigo_registro) return;
    await navigator.clipboard.writeText(empresa.codigo_registro);
    toast.success('Código copiado');
    setAbierto(false);
  };

  const regenerar = async () => {
    if (!esSuperAdmin) return;
    const ok = await confirmar({
      titulo: 'Regenerar código',
      texto: 'El código anterior dejará de funcionar para nuevos registros.',
      botonConfirmar: 'Regenerar',
    });
    if (!ok) return;
    onRegenerarCodigo();
    setAbierto(false);
  };

  if (!empresa.codigo_registro) {
    if (!esSuperAdmin) return null;
    return (
      <button
        type="button"
        onClick={(ev) => { ev.stopPropagation(); onRegenerarCodigo(); }}
        className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-indigo-300 bg-indigo-50 px-2.5 py-1 text-xs font-bold text-indigo-700 transition-colors hover:bg-indigo-100"
        aria-label={`Generar código de registro de ${empresa.nombre}`}
        title="Generar código de registro"
      >
        <LlaveIcon />
        Generar código
      </button>
    );
  }

  return (
    <div className="relative mt-3 flex w-fit items-center gap-2 rounded-lg border-[1.5px] border-indigo-400 bg-indigo-100 px-2.5 py-1.5" onClick={ev => ev.stopPropagation()}>
      <span className="text-xs font-bold text-indigo-600">Código</span>
      <span className="font-mono text-sm font-black tracking-widest text-indigo-950">{empresa.codigo_registro}</span>
      <button
        type="button"
        title="Copiar código"
        aria-label={`Copiar código de registro de ${empresa.nombre}`}
        onClick={copiarCodigo}
        className="text-indigo-600 transition-colors hover:text-indigo-900"
      >
        <CopyIcon />
      </button>
      <button
        type="button"
        title="Más acciones"
        aria-label={`Más acciones para el código de ${empresa.nombre}`}
        onClick={() => setAbierto(v => !v)}
        className="text-indigo-600 transition-colors hover:text-indigo-900"
      >
        <MoreIcon />
      </button>
      {abierto && (
        <div className="absolute left-0 top-full z-10 mt-1 w-56 rounded-lg border border-gray-200 bg-white p-1 shadow-lg">
          <MenuCodigoButton onClick={copiarCodigo} label="Copiar código" icon={<CopyIcon />} />
          {esSuperAdmin && <MenuCodigoButton onClick={regenerar} label="Regenerar código" icon={<RefreshIcon />} danger />}
          {puedeReabrir && <MenuCodigoButton onClick={() => { onReabrirPlazo(); setAbierto(false); }} label="Reabrir plazo de pedido" icon={<ReabrirPlazoIcon />} />}
        </div>
      )}
    </div>
  );
}

function MenuCodigoButton({ onClick, label, icon, danger = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs font-semibold ${
        danger ? 'text-red-600 hover:bg-red-50' : 'text-gray-700 hover:bg-gray-50'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function CopyIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5" aria-hidden="true">
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function RefreshIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5" aria-hidden="true">
      <polyline points="23 4 23 10 17 10" />
      <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
    </svg>
  );
}

function MoreIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5" aria-hidden="true">
      <circle cx="12" cy="12" r="1" />
      <circle cx="19" cy="12" r="1" />
      <circle cx="5" cy="12" r="1" />
    </svg>
  );
}

function ConfirmDeleteModal({ empresa, onCerrar, onConfirmar, loading }) {
  const [dependencias, setDependencias] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let activa = true;
    getDependenciasEmpresa(empresa.id)
      .then((data) => {
        if (activa) setDependencias(data);
      })
      .catch((err) => {
        if (activa) setError(err?.message || 'No se pudieron consultar dependencias');
      })
      .finally(() => {
        if (activa) setCargando(false);
      });
    return () => { activa = false; };
  }, [empresa.id]);

  const bloqueada = dependencias && !dependencias.puedeEliminarse;

  return (
    <Modal onCerrar={onCerrar} titulo={`Eliminar ${empresa.nombre}`}>
      <div className="space-y-4">
        {cargando && <p className="text-sm text-gray-500">Revisando pedidos activos y cuenta corriente...</p>}
        {error && <p className="rounded-lg border border-red-100 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        {bloqueada && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
            <p className="text-sm font-semibold text-amber-900">No se puede eliminar esta empresa.</p>
            <p className="mt-2 text-sm text-amber-800">
              Pedidos activos: {dependencias.pedidosActivos}. Saldo de cuenta corriente: {dependencias.saldoCuentaCorriente}.
            </p>
          </div>
        )}
        {dependencias?.puedeEliminarse && (
          <div className="rounded-lg border border-red-100 bg-red-50 p-3">
            <p className="text-sm font-semibold text-red-800">La empresa se marcará como inactiva y eliminada.</p>
            <p className="mt-1 text-sm text-red-700">No hay pedidos activos ni saldo pendiente.</p>
          </div>
        )}
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onCerrar} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">
            {bloqueada ? 'Cerrar' : 'Cancelar'}
          </button>
          {dependencias?.puedeEliminarse && (
            <button
              type="button"
              onClick={onConfirmar}
              disabled={loading}
              className="rounded-lg bg-red-600 px-5 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
            >
              {loading ? 'Eliminando...' : 'Eliminar definitivamente'}
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}

function EmpleadosPanel({ empresa, esSuperAdmin, onAbrirCuenta }) {
  const { data: todosEmpleados = [] } = useEmpleados(empresa.id);
  const empleados = todosEmpleados.filter(e => e.rol !== 'admin');
  const updateEmpleado = useUpdateEmpleado();
  const deleteEmpleado = useDeleteEmpleado();
  const generarReset = useGenerarResetCode();
  const [modalEmpleado, setModalEmpleado] = useState(null);
  const [modalImportar, setModalImportar] = useState(false);
  const [modalReset, setModalReset] = useState(null); // { codigo, expira, empleado }

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
        <h2 className="font-bold text-gray-800">Empleados — {empresa.nombre}</h2>
        <div className="flex gap-2">
          <button onClick={() => setModalImportar(true)} className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-semibold text-gray-600 hover:bg-gray-50">
            Importar CSV
          </button>
          <button onClick={() => setModalEmpleado({ empresa_id: empresa.id })} className="rounded-lg bg-green-700 px-3 py-1.5 text-sm font-semibold text-white hover:bg-green-800">
            + Agregar
          </button>
        </div>
      </div>

      <div className="space-y-2">
        {empleados.map(emp => (
          <div key={emp.id} className="flex flex-col gap-3 py-2 border-b border-gray-50 last:border-0 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="font-medium text-sm">{emp.nombre} {emp.apellido}</p>
              <p className="text-xs text-gray-500">{emp.email} · {emp.rol === 'admin' ? 'Administrador' : 'Cliente'}</p>
              {(emp.telefono || emp.fecha_nacimiento) && (
                <p className="text-xs text-gray-500 mt-0.5">
                  {emp.telefono || 'Sin teléfono'}
                  {emp.fecha_nacimiento ? ` · Nac. ${formatearFechaCorta(emp.fecha_nacimiento)}` : ''}
                </p>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:justify-end">
              <button
                type="button"
                onClick={() => onAbrirCuenta(emp)}
                className={iconButtonClass}
                aria-label={`Cuenta corriente de ${emp.nombre} ${emp.apellido}`}
                title="Cuenta corriente"
              >
                <CuentaCorrienteIcon />
              </button>
              <button
                onClick={() => updateEmpleado.mutate({ id: emp.id, data: { activo: !emp.activo } })}
                className={`text-xs px-2 py-0.5 rounded-full font-medium ${emp.activo ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}
              >
                {emp.activo ? 'Activo' : 'Inactivo'}
              </button>
              <button
                type="button"
                onClick={async () => {
                  try {
                    const data = await generarReset.mutateAsync(emp.id);
                    setModalReset(data);
                  } catch (e) { toast.error(e?.message || 'Error generando código'); }
                }}
                aria-label={`Generar código de recuperación de contraseña para ${emp.nombre} ${emp.apellido}`}
                title="Generar código de recuperación de contraseña"
                className={iconButtonClass}
              >
                <LlaveIcon />
              </button>
              <button
                type="button"
                onClick={() => setModalEmpleado(emp)}
                className={iconButtonClass}
                aria-label={`Editar ${emp.nombre} ${emp.apellido}`}
                title="Editar"
              >
                <EditarIcon />
              </button>
              {esSuperAdmin && (
              <button
                type="button"
                onClick={async () => {
                  try {
                    await deleteEmpleado.mutateAsync(emp.id);
                    toast.success('Empleado eliminado');
                  } catch (e) { toast.error(e?.message || 'Error'); }
                }}
                className={dangerIconButtonClass}
                aria-label={`Eliminar ${emp.nombre} ${emp.apellido}`}
                title="Eliminar"
              >
                <EliminarIcon />
              </button>
              )}
            </div>
          </div>
        ))}
        {empleados.length === 0 && <p className="text-gray-500 text-sm">Sin empleados aún.</p>}
      </div>

      {modalEmpleado && (
        <ModalEmpleado
          empresas={[empresa]}
          empleado={modalEmpleado}
          onCerrar={() => setModalEmpleado(null)}
        />
      )}

      {modalImportar && (
        <ModalImportarEmpleados empresa={empresa} onCerrar={() => setModalImportar(false)} />
      )}

      {/* Modal código de recuperación */}
      {modalReset && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 text-center">
            <div className="text-4xl mb-3">ðŸ"‘</div>
            <h3 className="text-lg font-bold text-gray-900 mb-1">Código de recuperación</h3>
            <p className="text-sm text-gray-500 mb-4">
              Para <strong>{modalReset.empleado}</strong>. Compartíselo por WhatsApp o mensaje. Expira el <strong>{modalReset.expira}</strong>.
            </p>
            <div className="bg-amber-50 border-2 border-amber-300 rounded-xl px-4 py-3 mb-4 flex items-center justify-between gap-3">
              <span className="font-mono font-bold text-2xl tracking-widest text-amber-800 flex-1 text-center">
                {modalReset.codigo}
              </span>
              <button
                onClick={() => { navigator.clipboard.writeText(modalReset.codigo); toast.success('Código copiado'); }}
                className="text-amber-500 hover:text-amber-700 flex-shrink-0"
                title="Copiar"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
              </button>
            </div>
            <p className="text-xs text-gray-500 mb-5">
              El empleado debe ir a "¿Olvidaste tu contraseña?" en la app e ingresar este código.
            </p>
            <button
              onClick={() => setModalReset(null)}
              className="w-full bg-gray-900 text-white font-semibold py-2.5 rounded-xl text-sm"
            >
              Listo
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function parseCsvLine(line) {
  const values = [];
  let current = '';
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];
    if (char === '"' && quoted && next === '"') {
      current += '"';
      i += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === ',' && !quoted) {
      values.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  values.push(current.trim());
  return values;
}

function normalizarHeader(header) {
  return header
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function parseEmpleadosCsv(texto) {
  const lines = texto.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length < 2) return [];
  const headers = parseCsvLine(lines[0]).map(normalizarHeader);
  return lines.slice(1).map((line) => {
    const cols = parseCsvLine(line);
    const row = {};
    headers.forEach((header, index) => {
      row[header] = cols[index] || '';
    });
    return {
      nombre: row.nombre || '',
      apellido: row.apellido || '',
      email: row.email || row.correo || '',
      telefono: row.telefono || row.celular || '',
      fecha_nacimiento: row.fecha_nacimiento || row.nacimiento || '',
      password: row.password || row.contrasena || '',
      rol: row.rol || 'cliente',
    };
  });
}

function ModalImportarEmpleados({ empresa, onCerrar }) {
  const importar = useImportarEmpleados();
  const [texto, setTexto] = useState('nombre,apellido,email,telefono,fecha_nacimiento,password\n');
  const [resultado, setResultado] = useState(null);
  const filas = parseEmpleadosCsv(texto);

  const cargarArchivo = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setTexto(await file.text());
    setResultado(null);
  };

  const enviar = async (event) => {
    event.preventDefault();
    if (filas.length === 0) {
      toast.warning('Pegá un CSV con encabezados y al menos una fila');
      return;
    }
    try {
      const data = await importar.mutateAsync({ empresa_id: empresa.id, empleados: filas });
      setResultado(data);
      toast.success(`Importación procesada: ${data.creados?.length || 0} creados`);
    } catch (e) {
      toast.error(e?.message || 'No se pudo importar el CSV');
    }
  };

  return (
    <Modal onCerrar={onCerrar} titulo={`Importar empleados — ${empresa.nombre}`}>
      <form onSubmit={enviar} className="space-y-4">
        <p className="text-sm text-gray-500">
          Encabezados aceptados: nombre, apellido, email, telefono, fecha_nacimiento, password y rol.
        </p>
        <input type="file" accept=".csv,text/csv" onChange={cargarArchivo} className="block w-full text-sm text-gray-600" />
        <textarea
          value={texto}
          onChange={(event) => { setTexto(event.target.value); setResultado(null); }}
          rows={8}
          className="w-full rounded-lg border border-gray-200 px-3 py-2 font-mono text-xs focus:border-green-500 focus:outline-none"
        />
        <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
          <p className="text-xs font-bold uppercase tracking-wide text-gray-500">Preview: {filas.length} fila{filas.length !== 1 ? 's' : ''}</p>
          <div className="mt-2 space-y-1">
            {filas.slice(0, 5).map((fila, index) => (
              <p key={`${fila.email}-${index}`} className="truncate text-xs text-gray-600">
                {index + 1}. {fila.apellido}, {fila.nombre} · {fila.email || 'sin email'}
              </p>
            ))}
            {filas.length > 5 && <p className="text-xs text-gray-500">+{filas.length - 5} filas más</p>}
          </div>
        </div>
        {resultado && (
          <div className="rounded-lg border border-green-100 bg-green-50 p-3 text-sm text-green-800">
            <p className="font-semibold">
              {resultado.creados?.length || 0} creados · {resultado.omitidos?.length || 0} omitidos · {resultado.errores?.length || 0} errores
            </p>
            {(resultado.errores || []).slice(0, 4).map((error) => (
              <p key={`${error.fila}-${error.email}`} className="mt-1 text-xs text-red-600">
                Fila {error.fila}: {error.email || 'sin email'} · {error.error}
              </p>
            ))}
          </div>
        )}
        <div className="flex justify-end gap-3">
          <button type="button" onClick={onCerrar} className="px-4 py-2 text-sm text-gray-600">Cerrar</button>
          <button type="submit" disabled={importar.isPending} className="rounded-lg bg-green-700 px-5 py-2 text-sm font-semibold text-white disabled:opacity-60">
            {importar.isPending ? 'Importando...' : 'Importar'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function ModalEmpresa({ empresa, planes, onGuardar, onCerrar, loading }) {
  const esNueva = !empresa;
  const nombreRef = useRef(null);
  const [form, setForm] = useState({
    nombre: empresa?.nombre || '',
    slug: empresa?.slug || '',
    plan: empresa?.plan || 'basico',
    plan_id: empresa?.plan_id || planes.find(plan => plan.activo)?.id || '',
    modo_pedido: empresa?.modo_pedido || 'semanal',
    dias_laborales: empresa?.dias_laborales || 'lunes_viernes',
    opcion_default: empresa?.opcion_default || '',
    activo: empresa?.activo ?? true,
    limite_hora: empresa?.limite_hora ? empresa.limite_hora.slice(0, 5) : '',
    limite_dia_semana: empresa?.limite_dia_semana || 'lunes',
    limite_anticipacion_dias: empresa?.limite_anticipacion_dias ?? 0,
    email: empresa?.email || '',
    telefono: empresa?.telefono || '',
  });
  const [errores, setErrores] = useState({});
  const [slugEditado, setSlugEditado] = useState(!esNueva);

  useEffect(() => {
    nombreRef.current?.focus();
  }, []);

  const set = (k, v) => {
    setForm(f => {
      const next = { ...f, [k]: v };
      if (k === 'nombre' && esNueva && !slugEditado) {
        next.slug = generarSlug(v);
      }
      return next;
    });
    setErrores(prev => ({ ...prev, [k]: '' }));
  };

  const setSlugManual = (value) => {
    setSlugEditado(true);
    set('slug', generarSlug(value));
  };

  const validar = () => {
    const nuevosErrores = {};
    const email = form.email.trim();

    if (!form.nombre.trim()) nuevosErrores.nombre = 'Ingresá el nombre de la empresa.';
    if (!form.slug.trim()) {
      nuevosErrores.slug = 'Ingresá el slug.';
    } else if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(form.slug.trim())) {
      nuevosErrores.slug = 'Usá solo letras, números y guiones.';
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      nuevosErrores.email = 'Ingresá un email válido.';
    }

    setErrores(nuevosErrores);
    return Object.keys(nuevosErrores).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validar()) return;

    const data = {
      ...form,
      nombre: form.nombre.trim(),
      slug: form.slug.trim(),
      email: form.email.trim(),
      telefono: form.telefono.trim(),
    };
    if (!data.plan_id) delete data.plan_id;
    if (!data.opcion_default) data.opcion_default = null;
    // Si no pusieron hora, limpiar los límites
    if (!data.limite_hora) {
      data.limite_hora = null;
      data.limite_dia_semana = null;
      data.limite_anticipacion_dias = 0;
    }
    onGuardar(empresa ? { ...data, id: empresa.id } : data);
  };

  const modo = form.modo_pedido;
  const tieneHora = !!form.limite_hora;

  return (
    <Modal
      onCerrar={onCerrar}
      titulo={empresa ? 'Editar empresa' : 'Nueva empresa'}
      footer={(
        <>
          <button type="button" onClick={onCerrar} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">Cancelar</button>
          <button type="submit" form="empresa-form" disabled={loading} className="bg-green-700 text-white px-5 py-2 rounded-lg text-sm font-semibold">
            {loading ? 'Guardando...' : 'Guardar'}
          </button>
        </>
      )}
    >
      <form id="empresa-form" onSubmit={handleSubmit} className="space-y-4" autoComplete="off" noValidate>
        <Campo label="Nombre">
          <input
            ref={nombreRef}
            className={input}
            value={form.nombre}
            onChange={e => set('nombre', e.target.value)}
            autoComplete="off"
            aria-invalid={Boolean(errores.nombre)}
            aria-describedby={errores.nombre ? 'empresa-nombre-error' : undefined}
          />
          {errores.nombre && <p id="empresa-nombre-error" className="mt-1 text-xs text-red-600">{errores.nombre}</p>}
        </Campo>
        <Campo label="Slug (identificador único, sin espacios)">
          <input
            className={input}
            value={form.slug}
            onChange={e => setSlugManual(e.target.value)}
            placeholder="ej: universidad-mendoza"
            autoComplete="off"
            aria-invalid={Boolean(errores.slug)}
            aria-describedby={errores.slug ? 'empresa-slug-error' : undefined}
          />
          {errores.slug && <p id="empresa-slug-error" className="mt-1 text-xs text-red-600">{errores.slug}</p>}
        </Campo>
        <Campo label="Plan">
          <select className={input} value={form.plan_id} onChange={e => set('plan_id', e.target.value ? Number(e.target.value) : '')}>
            <option value="">Seleccionar plan</option>
            {planes.filter(plan => plan.activo || Number(plan.id) === Number(form.plan_id)).map(plan => (
              <option key={plan.id} value={plan.id}>{etiquetaPlan(plan)}</option>
            ))}
          </select>
        </Campo>
        <Campo label="Modo de pedido">
          <select className={input} value={form.modo_pedido} onChange={e => set('modo_pedido', e.target.value)}>
            {Object.entries(MODOS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </Campo>
        <Campo label="Días laborales">
          <select className={input} value={form.dias_laborales} onChange={e => set('dias_laborales', e.target.value)}>
            {Object.entries(DIAS_LAB).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </Campo>
        <Campo label="Opción asignada (default estable, se puede excepcionar por semana desde Semana por Opción)">
          <select className={input} value={form.opcion_default} onChange={e => set('opcion_default', e.target.value)}>
            {Object.entries(OPCION_DEFAULT).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </Campo>

        {/* ── Configuración de límite ─────────────────────────── */}
        <div className="border border-gray-100 rounded-xl p-4 bg-gray-50 space-y-3">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Límite de pedidos</p>

          <Campo label="Hora de corte (dejar vacío = sin límite)">
            <input
              className={input}
              type="time"
              value={form.limite_hora}
              onChange={e => set('limite_hora', e.target.value)}
              placeholder="10:00"
            />
          </Campo>

          {tieneHora && (modo === 'semanal' || modo === 'ambos') && (
            <Campo label="Día límite (para pedido semanal)">
              <select className={input} value={form.limite_dia_semana} onChange={e => set('limite_dia_semana', e.target.value)}>
                {DIAS_SEMANA.map(d => <option key={d} value={d}>{DIAS_LABEL[d]}</option>)}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Los empleados deben pedir antes del {DIAS_LABEL[form.limite_dia_semana] || '""'} a las {form.limite_hora}hs.
              </p>
            </Campo>
          )}

          {tieneHora && (modo === 'diario' || modo === 'ambos') && (
            <Campo label="Anticipación requerida (para pedido diario)">
              <select className={input} value={form.limite_anticipacion_dias} onChange={e => set('limite_anticipacion_dias', parseInt(e.target.value))}>
                <option value={0}>Mismo día hasta las {form.limite_hora}hs</option>
                <option value={1}>Día anterior hasta las {form.limite_hora}hs</option>
              </select>
            </Campo>
          )}

          {!tieneHora && (
            <p className="text-xs text-gray-500">Sin límite: los empleados pueden pedir hasta que cerrés el menú manualmente.</p>
          )}
        </div>

        <Campo label="Email de contacto (opcional)">
          <input
            className={input}
            type="email"
            value={form.email}
            onChange={e => set('email', e.target.value)}
            placeholder="contacto@empresa.com"
            autoComplete="off"
            aria-invalid={Boolean(errores.email)}
            aria-describedby={errores.email ? 'empresa-email-error' : undefined}
          />
          {errores.email && <p id="empresa-email-error" className="mt-1 text-xs text-red-600">{errores.email}</p>}
        </Campo>
        <Campo label="Teléfono de contacto (opcional)">
          <input className={input} type="tel" value={form.telefono} onChange={e => set('telefono', e.target.value)} placeholder="+54 261 555-0000" autoComplete="off" />
        </Campo>

        {empresa && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.activo} onChange={e => set('activo', e.target.checked)} />
            Activa
          </label>
        )}
      </form>
    </Modal>
  );
}

function ModalEmpleado({ empresas, empleado, onCerrar }) {
  const createEmpleado = useCreateEmpleado();
  const updateEmpleado = useUpdateEmpleado();
  const esNuevo = !empleado?.id;
  const nombreRef = useRef(null);

  const [form, setForm] = useState({
    empresa_id: empleado?.empresa_id || empresas[0]?.id || '',
    nombre: esNuevo ? '' : empleado?.nombre || '',
    apellido: esNuevo ? '' : empleado?.apellido || '',
    email: esNuevo ? '' : empleado?.email || '',
    telefono: esNuevo ? '' : empleado?.telefono || '',
    fecha_nacimiento: esNuevo ? '' : normalizarFechaInput(empleado?.fecha_nacimiento),
    password: '',
    rol: esNuevo ? 'cliente' : empleado?.rol || 'cliente',
  });
  const [errores, setErrores] = useState({});

  useEffect(() => {
    nombreRef.current?.focus();
  }, []);

  const set = (k, v) => {
    setForm(f => ({ ...f, [k]: v }));
    setErrores(prev => ({ ...prev, [k]: '' }));
  };

  const validar = () => {
    const nuevosErrores = {};
    const email = form.email.trim();

    if (!form.nombre.trim()) nuevosErrores.nombre = 'Ingresá el nombre.';
    if (!form.apellido.trim()) nuevosErrores.apellido = 'Ingresá el apellido.';
    if (!email) {
      nuevosErrores.email = 'Ingresá el email.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      nuevosErrores.email = 'Ingresá un email válido.';
    }
    if (esNuevo && !form.password.trim()) nuevosErrores.password = 'Ingresá una contraseña.';

    setErrores(nuevosErrores);
    return Object.keys(nuevosErrores).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validar()) return;

    const payload = {
      ...form,
      nombre: form.nombre.trim(),
      apellido: form.apellido.trim(),
      email: form.email.trim(),
    };

    if (esNuevo) {
      await createEmpleado.mutateAsync(payload);
    } else {
      const { password, ...rest } = payload;
      const data = password ? { ...rest, password } : rest;
      await updateEmpleado.mutateAsync({ id: empleado.id, data });
    }
    onCerrar();
  };

  return (
    <Modal
      onCerrar={onCerrar}
      titulo={esNuevo ? 'Nuevo empleado' : 'Editar empleado'}
      footer={(
        <>
          <button type="button" onClick={onCerrar} className="px-4 py-2 text-sm text-gray-600">Cancelar</button>
          <button type="submit" form="empleado-form" disabled={createEmpleado.isPending || updateEmpleado.isPending} className="bg-green-700 text-white px-5 py-2 rounded-lg text-sm font-semibold">
            {createEmpleado.isPending || updateEmpleado.isPending ? 'Guardando...' : 'Guardar'}
          </button>
        </>
      )}
    >
      <form id="empleado-form" onSubmit={handleSubmit} className="space-y-4" autoComplete="off" noValidate>
        <Campo label="Empresa">
          <select className={input} value={form.empresa_id} onChange={e => set('empresa_id', parseInt(e.target.value))}>
            {empresas.map(em => <option key={em.id} value={em.id}>{em.nombre}</option>)}
          </select>
        </Campo>
        <div className="grid grid-cols-2 gap-3">
          <Campo label="Nombre">
            <input
              ref={nombreRef}
              className={input}
              value={form.nombre}
              onChange={e => set('nombre', e.target.value)}
              autoComplete="off"
              aria-invalid={Boolean(errores.nombre)}
              aria-describedby={errores.nombre ? 'empleado-nombre-error' : undefined}
            />
            {errores.nombre && <p id="empleado-nombre-error" className="mt-1 text-xs text-red-600">{errores.nombre}</p>}
          </Campo>
          <Campo label="Apellido">
            <input
              className={input}
              value={form.apellido}
              onChange={e => set('apellido', e.target.value)}
              autoComplete="off"
              aria-invalid={Boolean(errores.apellido)}
              aria-describedby={errores.apellido ? 'empleado-apellido-error' : undefined}
            />
            {errores.apellido && <p id="empleado-apellido-error" className="mt-1 text-xs text-red-600">{errores.apellido}</p>}
          </Campo>
        </div>
        <Campo label="Email">
          <input
            className={input}
            type="email"
            name="empleado-email"
            value={form.email}
            onChange={e => set('email', e.target.value)}
            placeholder="martin@empresa.com"
            autoComplete="off"
            aria-invalid={Boolean(errores.email)}
            aria-describedby={errores.email ? 'empleado-email-error' : undefined}
          />
          {errores.email && <p id="empleado-email-error" className="mt-1 text-xs text-red-600">{errores.email}</p>}
        </Campo>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Campo label="Teléfono">
            <input className={input} type="tel" value={form.telefono} onChange={e => set('telefono', e.target.value)} placeholder="+54 261 555-0000" autoComplete="off" />
          </Campo>
          <Campo label="Fecha de nacimiento">
            <input className={input} type="date" value={form.fecha_nacimiento} onChange={e => set('fecha_nacimiento', e.target.value)} />
          </Campo>
        </div>
        <Campo label={esNuevo ? 'contraseña' : 'Nueva contraseña (dejar vacío para no cambiar)'}>
          <input
            className={input}
            type="password"
            name="empleado-password"
            value={form.password}
            onChange={e => set('password', e.target.value)}
            placeholder={esNuevo ? '' : '"¢"¢"¢"¢"¢"¢"¢"¢'}
            autoComplete="new-password"
            aria-invalid={Boolean(errores.password)}
            aria-describedby={errores.password ? 'empleado-password-error' : undefined}
          />
          {errores.password && <p id="empleado-password-error" className="mt-1 text-xs text-red-600">{errores.password}</p>}
        </Campo>
        <Campo label="Rol">
          <select className={input} value={form.rol} onChange={e => set('rol', e.target.value)}>
            <option value="cliente">Cliente</option>
            <option value="admin">Administrador</option>
          </select>
        </Campo>
      </form>
    </Modal>
  );
}

function Modal({ titulo, onCerrar, children, footer }) {
  const modalRef = useRef(null);

  useEffect(() => {
    const handleKeyDown = (event) => {
      const modals = document.querySelectorAll('[data-admin-modal="true"]');
      if (modals[modals.length - 1] !== modalRef.current) return;
      if (event.key === 'Escape') onCerrar();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onCerrar]);

  return (
    <div
      className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-0 md:p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCerrar();
      }}
    >
      <div ref={modalRef} data-admin-modal="true" className="flex h-full max-h-none w-full flex-col bg-white shadow-xl md:h-auto md:max-h-[90vh] md:max-w-md md:rounded-2xl">
        <div className="flex justify-between items-center p-5 border-b flex-shrink-0">
          <h3 className="font-bold text-lg">{titulo}</h3>
          <button type="button" onClick={onCerrar} className="text-gray-500 hover:text-gray-700 text-xl" aria-label="Cerrar">✕</button>
        </div>
        <div className="p-5 overflow-y-auto">{children}</div>
        {footer && (
          <div className="flex flex-shrink-0 justify-end gap-3 border-t border-gray-100 bg-white p-4">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

function Campo({ label, children }) {
  return <label className="block"><span className="text-sm font-semibold text-gray-700 block mb-1">{label}</span>{children}</label>;
}

function ModalReopenPlazo({ empresa, onReabrir, onCerrarOverride, onCerrar, loading }) {
  const [horas, setHoras] = useState(2);
  const tieneOverrideActivo = empresa.plazo_override_hasta && new Date() <= new Date(empresa.plazo_override_hasta);

  return (
    <Modal onCerrar={onCerrar} titulo={`Reabrir plazo "" ${empresa.nombre}`}>
      <div className="space-y-4">
        {tieneOverrideActivo && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-3">
            <p className="text-sm text-green-800 font-medium">
              ðŸ"" Plazo actualmente abierto hasta las{' '}
              {new Date(empresa.plazo_override_hasta).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}hs
            </p>
            <button
              onClick={onCerrarOverride}
              disabled={loading}
              className="mt-2 text-xs text-red-600 hover:text-red-800 font-medium hover:underline"
            >
              Cerrar ventana ahora
            </button>
          </div>
        )}

        <p className="text-sm text-gray-600">
          Esto permite que los empleados de <strong>{empresa.nombre}</strong> hagan o modifiquen su pedido aunque haya pasado el límite habitual.
        </p>

        <Campo label="Abrir por cuántas horas">
          <select
            className={input}
            value={horas}
            onChange={e => setHoras(parseInt(e.target.value))}
          >
            <option value={1}>1 hora</option>
            <option value={2}>2 horas</option>
            <option value={4}>4 horas</option>
            <option value={8}>8 horas (hasta maÁ±ana)</option>
            <option value={24}>24 horas</option>
          </select>
        </Campo>

        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onCerrar} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">
            Cancelar
          </button>
          <button
            onClick={() => onReabrir(horas)}
            disabled={loading}
            className="bg-amber-600 text-white px-5 py-2 rounded-lg text-sm font-semibold hover:bg-amber-700 disabled:opacity-50"
          >
            {loading ? 'Abriendo...' : `Reabrir por ${horas}h`}
          </button>
        </div>
      </div>
    </Modal>
  );
}

const input = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-500';
