import { useState } from 'react';
import { usePlanes, useCreatePlan, useUpdatePlan, useDeletePlan } from '../hooks/usePlanes.js';
import { useEmpresas } from '../hooks/useEmpresas.js';
import SideDrawer from '../components/ui/SideDrawer.jsx';
import Modal from '../components/ui/Modal.jsx';
import Spinner from '../components/ui/Spinner.jsx';
import { toast } from '../lib/toast.js';

// ── helpers ───────────────────────────────────────────────────────────
const input = 'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-green-600 focus:outline-none focus:ring-1 focus:ring-green-200';

function Campo({ label, children, hint }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-semibold text-gray-700">{label}</label>
      {children}
      {hint && <p className="mt-1 text-xs text-gray-400">{hint}</p>}
    </div>
  );
}

function gramajeLegible(plan) {
  if (!plan.gramaje_min) return '—';
  if (plan.gramaje_max && plan.gramaje_max !== plan.gramaje_min) {
    return `${plan.gramaje_min}–${plan.gramaje_max} g`;
  }
  return `${plan.gramaje_min} g`;
}

// ── Chips de extras ───────────────────────────────────────────────────
function ExtrasChips({ plan, size = 'sm' }) {
  const cls = size === 'xs'
    ? 'text-[9px] px-1.5 py-px font-semibold rounded-full border'
    : 'text-xs px-2 py-0.5 font-semibold rounded-full border';
  return (
    <div className="flex flex-wrap gap-1">
      {plan.incluye_postre && (
        <span className={`${cls} bg-amber-50 text-amber-700 border-amber-200`}>Postre</span>
      )}
      {plan.incluye_bebida && (
        <span className={`${cls} bg-blue-50 text-blue-700 border-blue-200`}>Bebida</span>
      )}
      {!plan.incluye_postre && !plan.incluye_bebida && (
        <span className={`${cls} bg-gray-50 text-gray-400 border-gray-100`}>Solo vianda</span>
      )}
    </div>
  );
}

// ── Formulario del plan (en SideDrawer) ───────────────────────────────
function FormPlan({ plan, onGuardado, onCancelar }) {
  const createPlan = useCreatePlan();
  const updatePlan = useUpdatePlan();

  const [form, setForm] = useState({
    nombre:         plan?.nombre         ?? '',
    codigo:         plan?.codigo         ?? '',
    descripcion:    plan?.descripcion    ?? '',
    gramaje_min:    plan?.gramaje_min    ?? 450,
    gramaje_max:    plan?.gramaje_max    ?? '',
    incluye_postre: plan?.incluye_postre ?? false,
    incluye_bebida: plan?.incluye_bebida ?? false,
    activo:         plan?.activo         ?? true,
    orden:          plan?.orden          ?? 0,
  });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const isPending = createPlan.isPending || updatePlan.isPending;

  const handleSubmit = async (e) => {
    e.preventDefault();
    const payload = {
      ...form,
      gramaje_min: Number(form.gramaje_min),
      gramaje_max: form.gramaje_max ? Number(form.gramaje_max) : null,
      orden:       Number(form.orden || 0),
    };
    try {
      if (plan) {
        await updatePlan.mutateAsync({ id: plan.id, data: payload });
        toast.success('Plan actualizado');
      } else {
        await createPlan.mutateAsync(payload);
        toast.success('Plan creado');
      }
      onGuardado();
    } catch (err) {
      toast.error(err?.message || 'No se pudo guardar el plan');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="p-5 space-y-4">
      <Campo label="Nombre">
        <input
          className={input} required
          value={form.nombre}
          onChange={e => set('nombre', e.target.value)}
          placeholder="Plan Clásico 450"
        />
      </Campo>

      <Campo label="Código" hint="Se genera automáticamente desde el nombre si queda vacío.">
        <input
          className={input}
          value={form.codigo}
          onChange={e => set('codigo', e.target.value)}
          placeholder="clasico-450"
        />
      </Campo>

      <div className="grid grid-cols-2 gap-3">
        <Campo label="Gramaje mínimo (g)">
          <input
            className={input} type="number" min="1" required
            value={form.gramaje_min}
            onChange={e => set('gramaje_min', e.target.value)}
          />
        </Campo>
        <Campo label="Gramaje máximo (g)" hint="Opcional">
          <input
            className={input} type="number" min="1"
            value={form.gramaje_max}
            onChange={e => set('gramaje_max', e.target.value)}
            placeholder={String(form.gramaje_min)}
          />
        </Campo>
      </div>

      <div>
        <p className="mb-2 text-sm font-semibold text-gray-700">Incluye</p>
        <div className="grid grid-cols-2 gap-3">
          <label className={`flex items-center gap-2.5 cursor-pointer rounded-xl border px-3 py-3 text-sm transition-colors
            ${form.incluye_postre ? 'border-amber-300 bg-amber-50 text-amber-800' : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'}`}>
            <input
              type="checkbox" className="hidden"
              checked={form.incluye_postre}
              onChange={e => set('incluye_postre', e.target.checked)}
            />
            <span className="text-lg">{form.incluye_postre ? '🍮' : '○'}</span>
            <span className="font-semibold">Postre</span>
          </label>
          <label className={`flex items-center gap-2.5 cursor-pointer rounded-xl border px-3 py-3 text-sm transition-colors
            ${form.incluye_bebida ? 'border-blue-300 bg-blue-50 text-blue-800' : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'}`}>
            <input
              type="checkbox" className="hidden"
              checked={form.incluye_bebida}
              onChange={e => set('incluye_bebida', e.target.checked)}
            />
            <span className="text-lg">{form.incluye_bebida ? '🥤' : '○'}</span>
            <span className="font-semibold">Bebida</span>
          </label>
        </div>
      </div>

      <Campo label="Descripción" hint="Visible solo en el panel admin.">
        <textarea
          className={input} rows={2}
          value={form.descripcion}
          onChange={e => set('descripcion', e.target.value)}
          placeholder="Notas internas sobre este plan..."
        />
      </Campo>

      <div className="grid grid-cols-2 gap-3 items-end">
        <Campo label="Orden de listado">
          <input
            className={input} type="number"
            value={form.orden}
            onChange={e => set('orden', e.target.value)}
          />
        </Campo>
        <label className={`flex items-center gap-2 cursor-pointer rounded-xl border px-3 py-3 text-sm mb-0 transition-colors
          ${form.activo ? 'border-green-300 bg-green-50 text-green-800' : 'border-gray-200 bg-gray-50 text-gray-500'}`}>
          <input
            type="checkbox" className="hidden"
            checked={form.activo}
            onChange={e => set('activo', e.target.checked)}
          />
          <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0
            ${form.activo ? 'border-green-500 bg-green-500' : 'border-gray-300 bg-white'}`}>
            {form.activo && <div className="w-2 h-2 rounded-full bg-white" />}
          </div>
          <span className="font-semibold">{form.activo ? 'Activo' : 'Inactivo'}</span>
        </label>
      </div>

      <div className="flex gap-2 pt-2 border-t border-gray-100">
        <button type="button" onClick={onCancelar} className="btn-secondary flex-1">
          Cancelar
        </button>
        <button type="submit" disabled={isPending} className="btn-primary flex-1 flex items-center justify-center gap-1.5">
          {isPending && <Spinner size="sm" />}
          {plan ? 'Guardar cambios' : 'Crear plan'}
        </button>
      </div>
    </form>
  );
}

// ── Componente principal ──────────────────────────────────────────────
export default function Planes() {
  const { data: planes = [], isLoading } = usePlanes();
  const { data: empresasResponse } = useEmpresas({ pageSize: 500 });
  const deletePlan = useDeletePlan();

  const [filtro, setFiltro]         = useState('activos'); // 'todos' | 'activos' | 'inactivos'
  const [drawerPlan, setDrawerPlan]  = useState(null);     // plan | 'nuevo' | null
  const [confirmDel, setConfirmDel]  = useState(null);     // plan | null

  const empresas = empresasResponse?.data ?? [];

  // Cuántas empresas usan cada plan
  const cuentaPorPlan = {};
  empresas.forEach(e => {
    if (e.plan_id) cuentaPorPlan[e.plan_id] = (cuentaPorPlan[e.plan_id] ?? 0) + 1;
  });

  const planesFiltrados = planes
    .filter(p => {
      if (filtro === 'activos')   return p.activo;
      if (filtro === 'inactivos') return !p.activo;
      return true;
    })
    .sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0) || a.nombre.localeCompare(b.nombre));

  const handleDesactivar = async (plan) => {
    try {
      await deletePlan.mutateAsync(plan.id);
      toast.success('Plan desactivado');
      setConfirmDel(null);
    } catch (e) {
      toast.error(e?.message || 'No se pudo desactivar');
    }
  };

  const cerrarDrawer = () => setDrawerPlan(null);

  const planActivo = drawerPlan && drawerPlan !== 'nuevo' ? drawerPlan : null;
  const drawerTitulo = drawerPlan === 'nuevo' ? 'Nuevo plan' : drawerPlan ? `Editar: ${drawerPlan.nombre}` : '';

  const FILTROS = [
    { key: 'activos',   label: 'Activos' },
    { key: 'inactivos', label: 'Inactivos' },
    { key: 'todos',     label: 'Todos' },
  ];

  return (
    <div className="min-h-full min-w-0 overflow-x-hidden bg-gray-50">
      {/* Contenido */}
      <div className="mx-auto max-w-[860px] px-4 py-5 pb-24 md:px-6">
        {/* Barra de acciones */}
        <div className="flex items-center justify-between gap-4 mb-4">
          <div className="flex gap-1.5">
            {FILTROS.map(f => (
              <button
                key={f.key}
                onClick={() => setFiltro(f.key)}
                className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors
                  ${filtro === f.key
                    ? 'bg-green-600 text-white'
                    : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
              >
                {f.label}
                {f.key !== 'todos' && (
                  <span className="ml-1.5 text-[11px] opacity-70">
                    {planes.filter(p => f.key === 'activos' ? p.activo : !p.activo).length}
                  </span>
                )}
              </button>
            ))}
          </div>
          <button
            onClick={() => setDrawerPlan('nuevo')}
            className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 transition-colors shrink-0"
          >
            + Nuevo plan
          </button>
        </div>

        {/* Tabla */}
        {isLoading ? (
          <div className="flex justify-center py-16"><Spinner size="lg" /></div>
        ) : planesFiltrados.length === 0 ? (
          <div className="rounded-2xl border border-gray-200 bg-white py-16 text-center text-sm text-gray-400">
            No hay planes {filtro === 'activos' ? 'activos' : filtro === 'inactivos' ? 'inactivos' : ''}.
          </div>
        ) : (
          <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
            {/* Cabecera */}
            <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-0 bg-gray-50 border-b border-gray-200 px-4 py-2.5">
              <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Plan</div>
              <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 w-20 text-center">Gramaje</div>
              <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 w-24 text-center hidden sm:block">Incluye</div>
              <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 w-20 text-center hidden sm:block">Empresas</div>
              <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 w-20 text-right">Acciones</div>
            </div>

            {/* Filas */}
            <div className="divide-y divide-gray-50">
              {planesFiltrados.map(plan => {
                const numEmpresas = cuentaPorPlan[plan.id] ?? 0;
                return (
                  <div
                    key={plan.id}
                    className={`grid grid-cols-[1fr_auto_auto_auto_auto] gap-0 items-center px-4 py-3 cursor-pointer transition-colors hover:bg-gray-50
                      ${!plan.activo ? 'opacity-60' : ''}`}
                    onClick={() => setDrawerPlan(plan)}
                  >
                    {/* Nombre */}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-gray-900">{plan.nombre}</span>
                        {!plan.activo && (
                          <span className="text-[9px] font-bold uppercase tracking-wide text-gray-400 bg-gray-100 px-1.5 py-px rounded">Inactivo</span>
                        )}
                      </div>
                      {plan.descripcion && (
                        <p className="text-xs text-gray-400 truncate mt-0.5">{plan.descripcion}</p>
                      )}
                      {plan.codigo && (
                        <span className="text-[10px] text-gray-300 font-mono">{plan.codigo}</span>
                      )}
                    </div>

                    {/* Gramaje */}
                    <div className="w-20 text-center">
                      <span className="text-sm font-semibold text-gray-700">{gramajeLegible(plan)}</span>
                    </div>

                    {/* Extras */}
                    <div className="w-24 flex justify-center hidden sm:flex">
                      <ExtrasChips plan={plan} size="xs" />
                    </div>

                    {/* Empresas que lo usan */}
                    <div className="w-20 text-center hidden sm:block">
                      {numEmpresas > 0 ? (
                        <span className="text-sm font-semibold text-green-700">{numEmpresas}</span>
                      ) : (
                        <span className="text-sm text-gray-300">—</span>
                      )}
                    </div>

                    {/* Acciones rápidas */}
                    <div className="w-20 flex justify-end gap-1" onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => setDrawerPlan(plan)}
                        className="px-2.5 py-1.5 rounded-lg border border-gray-200 text-xs font-semibold text-gray-600 hover:bg-gray-100 transition-colors"
                      >
                        Editar
                      </button>
                      {plan.activo && numEmpresas === 0 && (
                        <button
                          onClick={() => setConfirmDel(plan)}
                          className="px-2.5 py-1.5 rounded-lg border border-red-100 text-xs font-semibold text-red-500 hover:bg-red-50 transition-colors"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Footer resumen */}
            <div className="px-4 py-2.5 border-t border-gray-100 bg-gray-50 flex items-center gap-4 text-xs text-gray-400">
              <span>{planes.filter(p => p.activo).length} activos</span>
              {planes.filter(p => !p.activo).length > 0 && (
                <span>{planes.filter(p => !p.activo).length} inactivos</span>
              )}
              <span className="ml-auto">Columna "Empresas" = cuántas empresas tienen este plan asignado</span>
            </div>
          </div>
        )}
      </div>

      {/* SideDrawer */}
      <SideDrawer
        open={Boolean(drawerPlan)}
        onClose={cerrarDrawer}
        title={drawerTitulo}
        width="md"
      >
        {drawerPlan && (
          <FormPlan
            plan={planActivo}
            onGuardado={cerrarDrawer}
            onCancelar={cerrarDrawer}
          />
        )}
      </SideDrawer>

      {/* Modal confirmar desactivar */}
      <Modal open={Boolean(confirmDel)} onClose={() => setConfirmDel(null)} title="Desactivar plan">
        {confirmDel && (
          <div className="space-y-4">
            <p className="text-sm text-gray-700">
              Desactivar <strong>{confirmDel.nombre}</strong>. El plan dejará de aparecer como opción para nuevas empresas.
            </p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setConfirmDel(null)} className="btn-secondary">Cancelar</button>
              <button
                onClick={() => handleDesactivar(confirmDel)}
                disabled={deletePlan.isPending}
                className="inline-flex items-center gap-1.5 rounded-lg bg-red-500 px-4 py-2 text-sm font-semibold text-white hover:bg-red-600 transition-colors disabled:opacity-50"
              >
                {deletePlan.isPending && <Spinner size="sm" />}
                Desactivar
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
