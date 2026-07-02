import { ClipboardList, UserRound, Utensils } from "lucide-react";
import { NavLink } from "react-router-dom";
import { unirClases } from "../../compartido/utils/clases.js";
import { rutasCliente } from "../../routes/rutasCliente.js";
import { iniciarMedicionPerformance } from "../../utils/performance.js";

const itemsNavegacion = [
  { to: rutasCliente.misPedidos, label: "Mis pedidos", Icono: ClipboardList },
  { to: rutasCliente.pedidoSemanal, label: "Pedido", Icono: Utensils, principal: true },
  { to: rutasCliente.miCuenta, label: "Mi cuenta", Icono: UserRound },
];

export default function BottomNavigation() {
  const manejarClick = (principal, destino) => {
    const finalizar = iniciarMedicionPerformance("nav:bottom-tab", { destino });
    requestAnimationFrame(() => finalizar({ estado: "click" }));
    if (!principal) return;
    window.dispatchEvent(new Event("pedido:ir-semana-actual"));
  };

  return (
    <nav
      aria-label="Navegacion principal"
      className="fixed inset-x-0 bottom-0 z-50 mx-auto max-w-[480px] border-t border-[#f0f0eb] bg-white/96 px-6 pt-0 pb-[calc(0.45rem+env(safe-area-inset-bottom))] shadow-[0_-10px_26px_rgba(45,90,39,0.05)] backdrop-blur md:max-w-[480px]"
    >
      <div className="grid grid-cols-3 gap-1">
        {itemsNavegacion.map(({ to, label, Icono, principal }) => (
          <NavLink
            key={to}
            to={to}
            aria-label={label}
            onClick={() => manejarClick(principal, to)}
            className={({ isActive }) =>
              unirClases(
                "relative flex min-h-16 flex-col items-center justify-center gap-1 px-2 text-[12px] font-bold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#586b24]",
                isActive
                  ? "text-[#586b24]"
                  : "text-[#b8b6af] hover:text-[#586b24]",
                principal && "font-black",
              )
            }
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <span
                    className="absolute top-0 h-0.5 w-10 rounded-full bg-[#586b24]"
                    aria-hidden="true"
                  />
                )}
                <Icono
                  className={unirClases("h-6 w-6", isActive ? "stroke-[2.6]" : "stroke-2")}
                  aria-hidden="true"
                />
                <span>{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
