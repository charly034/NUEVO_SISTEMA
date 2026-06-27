import { usePedidoSemanal } from "../../hooks/usePedidoSemanal.js";
import AppMobileShell from "../layout/AppMobileShell.jsx";
import HeaderUsuario from "./HeaderUsuario.jsx";
import SemanaContainer from "./SemanaContainer.jsx";

function obtenerNombreEmpleado(empleado) {
  return empleado?.nombre || empleado?.name || "Test";
}

function SkeletonPedidoSemanal() {
  return (
    <section
      aria-label="Cargando pedido semanal"
      className="-mx-4 flex min-h-0 flex-1 flex-col px-4 md:-mx-6 md:px-6"
    >
      <div className="mb-3 rounded-2xl border border-[#d8e6d4] bg-[#f0f7ee] px-3 py-2 text-sm font-black text-[#2d5a27]">
        Estamos preparando tu pedido...
      </div>
      <div className="min-h-0 flex-1 rounded-3xl border border-[#eee8df] bg-white p-3 shadow-sm">
        <div className="mb-3 h-5 w-36 animate-pulse rounded-full bg-[#e8e3da]" />
        <div className="mb-4 h-16 animate-pulse rounded-2xl bg-[#f0f7ee]" />
        <div className="space-y-2">
          <div className="h-14 animate-pulse rounded-2xl bg-[#faf8f4]" />
          <div className="h-14 animate-pulse rounded-2xl bg-[#faf8f4]" />
          <div className="h-14 animate-pulse rounded-2xl bg-[#faf8f4]" />
          <div className="h-14 animate-pulse rounded-2xl bg-[#faf8f4]" />
        </div>
      </div>
    </section>
  );
}

export default function PedidoContainer({ empleado }) {
  const nombre = obtenerNombreEmpleado(empleado);
  const {
    cargarPedidoSemanal,
    cargando,
    cambiarModoSemana,
    errorCarga,
    errorGuardado,
    fechaReferencia,
    guardarCambios,
    guardarSugerencia,
    indiceInicial,
    modoActivo,
    registrarIndiceActivo,
    registrarCambiosEdicion,
    semanas,
  } = usePedidoSemanal({ empleado });

  const haySemanasCacheadas = semanas.length > 0;

  return (
    <AppMobileShell>
      <HeaderUsuario nombre={nombre} />
      {cargando && !haySemanasCacheadas && <SkeletonPedidoSemanal />}
      {errorCarga && (
        <div className="rounded-2xl border border-[#edd9b8] bg-[#fff7eb] px-3 py-2 text-sm font-bold text-[#8a5a18]">
          <p>{errorCarga}</p>
          <button
            type="button"
            className="mt-1 font-black underline underline-offset-2"
            onClick={cargarPedidoSemanal}
          >
            Reintentar
          </button>
        </div>
      )}
      {errorGuardado && (
        <div className="rounded-2xl border border-[#f0ccc3] bg-[#fff0ed] px-3 py-2 text-sm font-bold text-[#8a3d30]">
          {errorGuardado}
        </div>
      )}
      {!cargando && !errorCarga && semanas.length === 0 && (
        <div className="rounded-2xl border border-[#e8e3da] bg-white px-3 py-3 text-sm font-bold text-[#716c64]">
          No hay semanas disponibles para pedido.
        </div>
      )}
      {(!cargando || haySemanasCacheadas) && (
        <SemanaContainer
          fechaActual={fechaReferencia}
          indiceInicial={indiceInicial}
          modoActivo={modoActivo}
          semanas={semanas}
          onActualizarSemana={guardarCambios}
          onGuardarSugerencia={guardarSugerencia}
          onCambiarModoSemana={cambiarModoSemana}
          onDirtyChange={registrarCambiosEdicion}
          onIndiceActivoChange={registrarIndiceActivo}
        />
      )}
    </AppMobileShell>
  );
}
