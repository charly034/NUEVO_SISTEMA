import { ClipboardList, UserRound, Utensils } from "lucide-react";
import { NavLink } from "react-router-dom";
import { unirClases } from "../../compartido/utils/clases.js";

const itemsNavegacion = [
  { to: "/pedido", label: "Pedido", Icono: Utensils },
  { to: "/historial", label: "Mis pedidos", Icono: ClipboardList },
  { to: "/perfil", label: "Mi cuenta", Icono: UserRound },
];

export default function BottomNavigation() {
  return (
    <nav
      aria-label="Navegación principal"
      className="fixed inset-x-0 bottom-0 z-50 mx-auto max-w-[480px] border-t border-[#eee8df] bg-white/95 px-3 pt-2 pb-[calc(0.75rem+env(safe-area-inset-bottom))] shadow-[0_-14px_34px_rgba(45,90,39,0.08)] backdrop-blur"
    >
      <div className="grid grid-cols-3 gap-1">
        {itemsNavegacion.map(({ to, label, Icono }) => (
          <NavLink
            key={to}
            to={to}
            aria-label={label}
            className={({ isActive }) =>
              unirClases(
                "flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl px-2 text-[11px] font-bold transition",
                isActive
                  ? "bg-[#f0f7ee] text-[#2d5a27]"
                  : "text-[#77736b] hover:bg-[#faf8f4] hover:text-[#2d5a27]",
              )
            }
          >
            {({ isActive }) => (
              <>
                <Icono
                  className={unirClases(
                    "h-5 w-5",
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
