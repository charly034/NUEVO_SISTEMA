import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useMenuSemanal } from '../hooks/useMenus.js';
import { useOfertaSemanal } from '../hooks/useCocina.js';
import { useEmpresas } from '../hooks/useEmpresas.js';
import Spinner from '../components/ui/Spinner.jsx';
import ErrorMessage from '../components/ui/ErrorMessage.jsx';
import { DIAS_LABORALES as DIAS, DIA_NOMBRE as DIA_LABEL_LARGO, indiceDia } from '../lib/dias.js';

function soloFecha(str) { return str ? str.split('T')[0] : str; }

function formatCorto(isoStr) {
  const f = soloFecha(isoStr);
  if (!f) return '';
  const [, m, d] = f.split('-');
  return `${d}/${m}`;
}

function fechaDia(fechaInicio, dia) {
  const offset = indiceDia(dia);
  if (offset < 0) return '';
  const [y, m, d] = soloFecha(fechaInicio).split('-').map(Number);
  const fecha = new Date(y, m - 1, d + offset);
  return `${String(fecha.getDate()).padStart(2,'0')}/${String(fecha.getMonth()+1).padStart(2,'0')}`;
}

// El filtro por empresa ya se aplica en DiaColumna (slotsFiltrados); esta
// tarjeta siempre recibe slots ya visibles para la empresa seleccionada.
function ViandaCard({ slot }) {
  const todasEmpresas = (slot.empresa_ids ?? []).length === 0;

  return (
    <div className="rounded-lg border border-gray-100 bg-white p-2.5 shadow-sm">
      <div className="flex items-start justify-between gap-1 mb-1">
        <p className="text-sm font-semibold text-gray-900 leading-tight">{slot.plato_nombre}</p>
      </div>
      {slot.nombre_vianda && slot.nombre_vianda !== slot.plato_nombre && (
        <p className="text-[11px] text-gray-500 italic mb-1">"{slot.nombre_vianda}"</p>
      )}
      {todasEmpresas ? (
        <p className="text-[11px] text-gray-500">Todas las empresas</p>
      ) : (
        <p className="text-[11px] text-gray-500">{(slot.empresa_nombres ?? []).join(', ')}</p>
      )}
    </div>
  );
}

function DiaColumna({ dia, fecha, slots, fijos = [], siempre, sinServicio, empresaFiltro }) {
  const slotsFiltrados = slots.filter((s) => {
    if (!empresaFiltro) return true;
    const todasEmpresas = (s.empresa_ids ?? []).length === 0;
    return todasEmpresas || (s.empresa_ids ?? []).includes(empresaFiltro);
  });

  const viandasCount = slotsFiltrados.length;

  return (
    <div className="flex flex-col min-w-0">
      {/* Header del día */}
      <div className="mb-2 text-center">
        <p className="text-xs font-bold uppercase tracking-wide text-gray-600">{DIA_LABEL_LARGO[dia]}</p>
        <p className="text-[11px] text-gray-500">{fecha}</p>
      </div>

      {sinServicio ? (
        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-red-200 bg-red-50 p-4 text-center min-h-[120px]">
          <p className="text-xs font-medium text-red-500">Sin servicio</p>
          {sinServicio.motivo && <p className="text-[10px] text-red-400 mt-0.5">{sinServicio.motivo}</p>}
        </div>
      ) : (
        <div className="space-y-2 flex-1">
          {slotsFiltrados.length === 0 && fijos.length === 0 && siempre.length === 0 ? (
            <div className="rounded-xl border-2 border-dashed border-gray-100 p-4 text-center min-h-[80px] flex items-center justify-center">
              <p className="text-xs text-gray-500">Sin platos</p>
            </div>
          ) : (
            <>
              {slotsFiltrados.map((slot) => (
                <ViandaCard key={slot.id} slot={slot} />
              ))}
              {fijos.length > 0 && (
                <div className="rounded-lg border border-gray-100 bg-gray-50 p-2">
                  <p className="text-[10px] font-semibold text-gray-500 mb-1">Platos fijos</p>
                  {fijos.map((p) => (
                    <p key={p.id} className="text-[11px] text-gray-600 leading-tight">{p.nombre}</p>
                  ))}
                </div>
              )}
              {siempre.length > 0 && (
                <div className="rounded-lg border border-emerald-100 bg-emerald-50 p-2">
                  <p className="text-[10px] font-semibold text-emerald-700 mb-1">Siempre disponibles</p>
                  {siempre.map((p) => (
                    <p key={p.id} className="text-[11px] text-emerald-700 leading-tight">{p.nombre}</p>
                  ))}
                </div>
              )}
            </>
          )}

          {/* Contador */}
          <div className="flex gap-1 pt-1">
            {viandasCount > 0 && (
              <span className="rounded-full bg-brand-100 px-2 py-0.5 text-[10px] font-semibold text-brand-700">{viandasCount} vianda{viandasCount !== 1 ? 's' : ''}</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function SemanaDetalle() {
  const { id } = useParams();
  const menuQuery = useMenuSemanal(id);
  const ofertaQuery = useOfertaSemanal(id);
  const empresasQuery = useEmpresas({ activo: true, limit: 200 });

  const [empresaFiltro, setEmpresaFiltro] = useState(null);

  const menu = menuQuery.data;
  const oferta = ofertaQuery.data;
  const empresas = empresasQuery.data?.empresas ?? [];

  if (menuQuery.isLoading || ofertaQuery.isLoading) {
    return <div className="flex justify-center items-center h-64"><Spinner size="lg" /></div>;
  }
  if (menuQuery.isError) {
    return <div className="p-6"><ErrorMessage message={menuQuery.error.message} onRetry={menuQuery.refetch} /></div>;
  }
  if (ofertaQuery.isError) {
    return <div className="p-6"><ErrorMessage message={ofertaQuery.error.message} onRetry={ofertaQuery.refetch} /></div>;
  }

  const diasMap = Object.fromEntries((oferta?.dias ?? []).map((d) => [d.dia, d]));
  const siempre = oferta?.siempre ?? [];
  const sinServicioMap = Object.fromEntries(
    (oferta?.dias ?? []).filter((d) => d.sin_servicio).map((d) => [d.dia, d])
  );

  return (
    <div className="p-4 md:p-6 space-y-5">
      {/* Header */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <Link to="/semanas" className="text-xs text-gray-500 hover:text-brand-600 transition-colors">
            ← Semanas
          </Link>
          <button type="button" onClick={() => window.print()} className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors">
            Imprimir
          </button>
        </div>
        <h1 className="text-xl font-bold text-gray-900">{menu?.nombre}</h1>
        <p className="text-xs text-gray-500 mt-0.5">
          {formatCorto(menu?.fecha_inicio)} — {formatCorto(menu?.fecha_fin)}
          {menu?.estado && (
            <span className={`ml-2 font-semibold ${menu.estado === 'publicado' ? 'text-green-600' : 'text-gray-500'}`}>
              {menu.estado}
            </span>
          )}
        </p>
        <div className="mt-3 flex gap-0 border-b border-gray-100">
          <span className="px-4 pb-2 text-sm font-semibold text-brand-700 border-b-2 border-brand-600 -mb-px">
            Oferta
          </span>
          <Link
            to={`/semanas/${id}/diseno`}
            className="px-4 pb-2 text-sm font-medium text-gray-500 hover:text-gray-800 border-b-2 border-transparent -mb-px transition-colors"
          >
            Disenar menu
          </Link>
        </div>
      </div>

      {/* Filtro por empresa */}
      {empresas.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-gray-500">Empresa:</span>
          <button
            type="button"
            onClick={() => setEmpresaFiltro(null)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${!empresaFiltro ? 'bg-brand-600 text-white' : 'border border-gray-200 text-gray-500 hover:border-brand-300'}`}
          >
            Todas
          </button>
          {empresas.map((e) => (
            <button
              key={e.id}
              type="button"
              onClick={() => setEmpresaFiltro(empresaFiltro === e.id ? null : e.id)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${empresaFiltro === e.id ? 'bg-brand-600 text-white' : 'border border-gray-200 text-gray-500 hover:border-brand-300'}`}
            >
              {e.nombre}
            </button>
          ))}
        </div>
      )}

      {/* Grilla semanal */}
      <div className="grid grid-cols-5 gap-3">
        {DIAS.map((dia) => {
          const diaData = diasMap[dia] ?? { slots: [], fijos: [] };
          return (
            <DiaColumna
              key={dia}
              dia={dia}
              fecha={menu ? fechaDia(menu.fecha_inicio, dia) : ''}
              slots={diaData.slots ?? []}
              fijos={diaData.fijos ?? []}
              siempre={siempre}
              sinServicio={sinServicioMap[dia] ?? null}
              empresaFiltro={empresaFiltro}
            />
          );
        })}
      </div>

      {/* Fines de semana si tienen contenido */}
      {['sabado','domingo'].some((d) => (diasMap[d]?.slots ?? []).length > 0 || sinServicioMap[d]) && (
        <div className="grid grid-cols-2 gap-3 max-w-md">
          {['sabado','domingo'].map((dia) => {
            const diaData = diasMap[dia] ?? { slots: [], fijos: [] };
            return (
              <DiaColumna
                key={dia}
                dia={dia}
                fecha={menu ? fechaDia(menu.fecha_inicio, dia) : ''}
                slots={diaData.slots ?? []}
                fijos={diaData.fijos ?? []}
                siempre={[]}
                sinServicio={sinServicioMap[dia] ?? null}
                empresaFiltro={empresaFiltro}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
