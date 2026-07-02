import Boton from "../ui/Boton.jsx";

export default function AccionesPedidoSemana({
  accionPrincipal,
  editando = false,
  guardando = false,
  modoCreacion = false,
  onCancelar,
  onConfirmar,
  onPrincipal,
}) {
  if (editando) {
    return (
      <div className="mt-auto shrink-0 space-y-2 border-t border-[#ecebe5] bg-white/94 px-6 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-4 shadow-[0_-10px_24px_rgba(26,26,26,0.05)]">
        <Boton anchoCompleto disabled={guardando} onClick={onConfirmar}>
          {guardando
            ? "Guardando..."
            : modoCreacion
              ? "Confirmar pedido semanal"
              : "Guardar cambios"}
        </Boton>
        <Boton
          anchoCompleto
          variante="suave"
          disabled={guardando}
          onClick={onCancelar}
        >
          Volver sin guardar
        </Boton>
      </div>
    );
  }

  if (!accionPrincipal) return null;

  return (
    <div className="mt-auto shrink-0 border-t border-[#ecebe5] bg-white/94 px-6 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-4 shadow-[0_-10px_24px_rgba(26,26,26,0.05)]">
      <Boton
        anchoCompleto
        onClick={onPrincipal}
      >
        {accionPrincipal}
      </Boton>
    </div>
  );
}
