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
      <div className="mt-auto grid shrink-0 grid-cols-[0.8fr_1.2fr] gap-2 pt-1 max-[700px]:pt-0">
        <Boton variante="secundario" disabled={guardando} onClick={onCancelar}>
          Cancelar
        </Boton>
        <Boton disabled={guardando} onClick={onConfirmar}>
          {guardando
            ? "Guardando..."
            : modoCreacion
              ? "Confirmar pedido"
              : "Guardar cambios"}
        </Boton>
      </div>
    );
  }

  if (!accionPrincipal) return null;

  return (
    <div className="mt-auto shrink-0 pt-1 max-[700px]:pt-0">
      <Boton
        anchoCompleto
        onClick={onPrincipal}
      >
        {accionPrincipal}
      </Boton>
    </div>
  );
}
