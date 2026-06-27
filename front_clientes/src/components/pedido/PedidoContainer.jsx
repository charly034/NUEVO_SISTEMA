import { usePedidoSemanal } from "../../hooks/usePedidoSemanal.js";
import AppMobileShell from "../layout/AppMobileShell.jsx";
import HeaderUsuario from "./HeaderUsuario.jsx";
import SemanaContainer from "./SemanaContainer.jsx";

function obtenerNombreEmpleado(empleado) {
  return empleado?.nombre || empleado?.name || "Test";
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
    indiceInicial,
    modoActivo,
    registrarCambiosEdicion,
    semanas,
  } = usePedidoSemanal({ empleado });

  return (
    <AppMobileShell>
      <HeaderUsuario nombre={nombre} />
      {cargando && (
        <div className="rounded-2xl border border-[#d8e6d4] bg-[#f0f7ee] px-3 py-2 text-sm font-black text-[#2d5a27]">
          Cargando tu pedido...
        </div>
      )}
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
      <SemanaContainer
        fechaActual={fechaReferencia}
        indiceInicial={indiceInicial}
        modoActivo={modoActivo}
        semanas={semanas}
        onActualizarSemana={guardarCambios}
        onCambiarModoSemana={cambiarModoSemana}
        onDirtyChange={registrarCambiosEdicion}
      />
    </AppMobileShell>
  );
}
