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
      aria-label="Navegación principal"
      className="fixed inset-x-0 bottom-0 z-50 mx-auto max-w-[480px] border-t border-[#eee8df] bg-white/95 px-3 pt-1.5 pb-[calc(0.45rem+env(safe-area-inset-bottom))] shadow-[0_-10px_26px_rgba(45,90,39,0.07)] backdrop-blur md:max-w-[760px] md:px-5 lg:max-w-[860px]"
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
                "flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-2xl px-2 text-[12px] font-bold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2d5a27] md:min-h-14 md:text-[13px]",
                isActive
                  ? "bg-[#f0f7ee] text-[#2d5a27]"
                  : "text-[#77736b] hover:bg-[#faf8f4] hover:text-[#2d5a27]",
                principal && "font-black",
              )
            }
          >
            {({ isActive }) => (
              <>
                <Icono
                  className={unirClases(
                    principal ? "h-5 w-5" : "h-[1.125rem] w-[1.125rem]",
                    isActive ? "stroke-[2.6]" : "stroke-2",
                  )}
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
