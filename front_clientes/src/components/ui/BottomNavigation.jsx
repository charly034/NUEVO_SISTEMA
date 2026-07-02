import { History, Home, User } from "lucide-react";
import { NavLink } from "react-router-dom";
import { useEffect, useState } from "react";
import { unirClases } from "../../compartido/utils/clases.js";
import { rutasCliente } from "../../routes/rutasCliente.js";
import { iniciarMedicionPerformance } from "../../utils/performance.js";

const STORAGE_INICIO_PENDIENTE = "la_quinta:pedido:inicio_pendiente";

const itemsNavegacion = [
  { to: rutasCliente.inicio, label: "Inicio", Icono: Home, principal: true, muestraBadge: true },
  { to: rutasCliente.historial, label: "Historial", Icono: History },
  { to: rutasCliente.perfil, label: "Perfil", Icono: User },
];

export default function BottomNavigation() {
  const [pedidoPendiente, setPedidoPendiente] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(STORAGE_INICIO_PENDIENTE) === "true";
  });

  useEffect(() => {
    function manejarEstadoInicio(event) {
      const pendiente = Boolean(event.detail?.pedidoPendiente);
      setPedidoPendiente(pendiente);
      try {
        window.localStorage.setItem(STORAGE_INICIO_PENDIENTE, pendiente ? "true" : "false");
      } catch {
        // El badge es un detalle visual; si storage falla, alcanza con el estado en memoria.
      }
    }

    window.addEventListener("pedido:estado-inicio", manejarEstadoInicio);
    return () => window.removeEventListener("pedido:estado-inicio", manejarEstadoInicio);
  }, []);

  const manejarClick = (principal, destino) => {
    const finalizar = iniciarMedicionPerformance("nav:bottom-tab", { destino });
    requestAnimationFrame(() => finalizar({ estado: "click" }));
    if (!principal) return;
    window.dispatchEvent(new Event("pedido:ir-semana-actual"));
  };

  return (
    <nav
      aria-label="Navegacion principal"
      className="fixed inset-x-0 bottom-0 z-50 mx-auto max-w-[480px] border-t border-[#f0f0eb] bg-white/96 px-5 pt-1 pb-[calc(0.35rem+env(safe-area-inset-bottom))] shadow-[0_-10px_26px_rgba(45,90,39,0.05)] backdrop-blur md:max-w-[480px]"
    >
      <div className="grid grid-cols-3 gap-1">
        {itemsNavegacion.map(({ to, label, Icono, principal, muestraBadge }) => (
          <NavLink
            key={to}
            to={to}
            aria-label={label}
            onClick={() => manejarClick(principal, to)}
            className={({ isActive }) =>
              unirClases(
                "relative flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-2xl px-2 text-[11px] font-bold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#586b24]",
                isActive
                  ? "bg-[#F2F5EA] text-[#586b24]"
                  : "text-[#b8b6af] hover:text-[#586b24]",
                principal && "font-black",
              )
            }
          >
            {({ isActive }) => (
              <>
                <Icono
                  className={unirClases("h-5 w-5", isActive ? "stroke-[2.6]" : "stroke-2")}
                  aria-hidden="true"
                />
                {muestraBadge && pedidoPendiente && !isActive && (
                  <span
                    className="absolute right-[calc(50%-1rem)] top-2.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-[#C8782A]"
                    aria-hidden="true"
                  />
                )}
                <span>{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
