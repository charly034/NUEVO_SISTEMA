import { DIAS_LABEL } from "../../utils/dias.js";
import { formatFecha } from "../../utils/dates.js";
import SelectorSemana from "./SelectorSemana.jsx";
import { Pantalla } from "./DiaCard.jsx";
import { CardHeader } from "./SemanaCards.jsx";
import { s, sEstado } from "./styles.js";

export function HeaderUsuario({ empleado }) {
  return (
    <div style={s.headerUsuarioWrap}>
      <h1 style={s.titulo}>Hola, {empleado.nombre} 👋</h1>
    </div>
  );
}

export function LoadingMenuState() {
  return (
    <Pantalla>
      <p style={sEstado.loadingTexto}>Cargando menú...</p>
    </Pantalla>
  );
}

export function ConfirmacionPedidoState({
  diasSemana,
  semanaInicio,
  empleado,
  selecciones,
  guarniciones,
  onVerPedido,
  onCancelar,
  cancelando,
}) {
  const diasConfirmados = diasSemana.filter(
    (dia) => selecciones[dia]?.plato_id,
  );

  return (
    <Pantalla>
      <div style={sEstado.confirmadoLayout}>
        <div style={sEstado.heroWrap}>
          <div style={sEstado.heroIconWrap}>
            <span style={sEstado.heroIcon}>✓</span>
          </div>
          <h2 style={sEstado.heroTitulo}>¡Pedido confirmado!</h2>
          <p style={sEstado.heroSub}>Semana del {formatFecha(semanaInicio)}</p>
          <p style={sEstado.heroMeta}>
            {empleado.nombre} {empleado.apellido} · {empleado.empresa.nombre}
          </p>
        </div>

        <div style={sEstado.resumenCard}>
          {diasConfirmados.map((dia, index) => (
            <div
              key={dia}
              style={{
                ...sEstado.resumenFila,
                ...(index < diasConfirmados.length - 1
                  ? sEstado.resumenFilaBorde
                  : null),
              }}
            >
              <span style={sEstado.resumenDia}>{DIAS_LABEL[dia]}</span>
              <div style={sEstado.resumenContenido}>
                <div style={sEstado.resumenPlato}>
                  {selecciones[dia].plato_nombre}
                </div>
                {selecciones[dia].guarnicion_id && (
                  <div style={sEstado.resumenGuarnicion}>
                    +{" "}
                    {
                      guarniciones.find(
                        (guarnicion) =>
                          guarnicion.id === selecciones[dia].guarnicion_id,
                      )?.nombre
                    }
                  </div>
                )}
                {selecciones[dia].notas && (
                  <div style={sEstado.resumenNotas}>
                    "{selecciones[dia].notas}"
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={onVerPedido}
          style={{ ...s.btnEnviar, marginBottom: 10 }}
        >
          Ver mi pedido
        </button>
        <button
          onClick={onCancelar}
          disabled={cancelando}
          style={sEstado.btnCancelarLink}
        >
          {cancelando ? "Cancelando..." : "Cancelar pedido"}
        </button>
      </div>
    </Pantalla>
  );
}

export function NoMenusPublicadosState({ empleado }) {
  return (
    <Pantalla noScroll>
      <HeaderUsuario empleado={empleado} />
      <div style={sEstado.noMenuCard}>
        <CardHeader
          icono="⏳"
          titulo="Menú no disponible"
          sub="Aún no hay menú publicado. Volvé más tarde."
          colorTitulo="#374151"
          colorSub="#6b7280"
        />
      </div>
    </Pantalla>
  );
}

export function PedidoCargandoState({
  empleado,
  menusDisponibles,
  semanaSelIdx,
  onChangeSemana,
}) {
  return (
    <Pantalla noScroll>
      <HeaderUsuario empleado={empleado} />
      <SelectorSemana
        menus={menusDisponibles}
        selIdx={semanaSelIdx}
        onChange={onChangeSemana}
        noScroll
      />
      <p style={sEstado.loadingPedidoTexto}>Cargando tu pedido...</p>
    </Pantalla>
  );
}

export function DiaSinServicioCard({ dia, fecha, motivo, diaRef }) {
  return (
    <div key={dia} ref={diaRef} style={s.sinServicioCard}>
      <div style={s.sinServicioBody}>
        <strong>{DIAS_LABEL[dia]}</strong>
        <span style={s.sinServicioMeta}> {formatFecha(fecha)}</span>
        <p style={s.sinServicioTexto}>
          Sin servicio
          {motivo ? `: ${motivo}` : ""}
        </p>
      </div>
    </div>
  );
}
