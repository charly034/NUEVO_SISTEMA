import { useEffect } from "react";
import AppMobileShell from "../components/layout/AppMobileShell.jsx";
import HeaderUsuario from "../components/pedido/HeaderUsuario.jsx";
import SemanaContainer from "../components/pedido/SemanaContainer.jsx";
import { semanasMock } from "../data/semanasMock.js";

export default function PedidoPage({ empleado }) {
  const nombre = empleado?.nombre || empleado?.name || "Florencia";

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, []);

  return (
    <AppMobileShell>
      <HeaderUsuario nombre={nombre} />
      <SemanaContainer semanas={semanasMock} />
    </AppMobileShell>
  );
}
