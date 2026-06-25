import { s } from "./styles.js";
import SelectorSemana from "./SelectorSemana.jsx";
import StepperProgreso from "./StepperProgreso.jsx";
import DiaCard, { Pantalla } from "./DiaCard.jsx";
import {
  HeaderUsuario,
  DiaSinServicioCard,
} from "./FormularioPedidoEstados.jsx";

export default function FormularioPedidoEditable({
  empleado,
  menusDisponibles,
  semanaSelIdx,
  setSemanaSelIdx,
  fechaLimiteVisible,
  textoLimitePedido,
  pedidoAnterior,
  tienePedidoGuardado,
  aplicarPedidoAnterior,
  diasConFechaYBloqueo,
  diasSinServicio,
  noAsiste,
  selecciones,
  diaEfectivo,
  toggleExpandido,
  diaRefs,
  menuSemana,
  menu,
  guarniciones,
  toggleNoAsiste,
  elegirPlato,
  setGuarnicion,
  setNotas,
  avanzarAlSiguiente,
  mostrarFooterPedido,
  envioBloqueado,
  handleEnviar,
  textoBotonEnviar,
  mutation,
}) {
  return (
    <Pantalla>
      <HeaderUsuario empleado={empleado} />

      <SelectorSemana
        menus={menusDisponibles}
        selIdx={semanaSelIdx}
        onChange={setSemanaSelIdx}
      />

      {fechaLimiteVisible && (
        <div style={s.fechaLimiteChip}>⏰ {textoLimitePedido}</div>
      )}

      {pedidoAnterior && !tienePedidoGuardado && (
        <button onClick={aplicarPedidoAnterior} style={s.btnRepetir}>
          ↩ Repetir pedido semana anterior
        </button>
      )}

      <div style={s.stickyStepperWrap}>
        <StepperProgreso
          dias={diasConFechaYBloqueo}
          diasSinServicio={diasSinServicio}
          noAsiste={noAsiste}
          selecciones={selecciones}
          diaActivo={diaEfectivo}
          onDia={toggleExpandido}
        />
      </div>

      <div style={s.diasListWrap}>
        {diasConFechaYBloqueo.map(({ dia, fecha, bloqueado }) =>
          diasSinServicio.has(dia) ? (
            <DiaSinServicioCard
              key={dia}
              dia={dia}
              fecha={fecha}
              motivo={diasSinServicio.get(dia)}
              diaRef={(el) => (diaRefs.current[dia] = el)}
            />
          ) : (
            <DiaCard
              key={dia}
              ref={(el) => (diaRefs.current[dia] = el)}
              dia={dia}
              fecha={fecha}
              bloqueado={bloqueado}
              bloqueadoTexto={
                menuSemana?.limiteEmpresa?.hora
                  ? `Cerrado ${menuSemana.limiteEmpresa.hora}`
                  : "Plazo cerrado"
              }
              noAsiste={!!noAsiste[dia]}
              onToggleAsiste={() => toggleNoAsiste(dia)}
              variablesDia={(menu.variables || []).filter(
                (plato) => plato.dia === dia,
              )}
              fijosDia={menu.fijos || []}
              seleccion={selecciones[dia]}
              guarniciones={guarniciones}
              onElegir={(plato, opcion) => elegirPlato(dia, plato, opcion)}
              onGuarnicion={(guarnicionId) => setGuarnicion(dia, guarnicionId)}
              onNotas={(notas) => setNotas(dia, notas)}
              expandido={diaEfectivo === dia}
              onToggleExpand={() => toggleExpandido(dia)}
              onAvanzar={() => avanzarAlSiguiente(dia, selecciones)}
            />
          ),
        )}
      </div>

      {mostrarFooterPedido && (
        <div style={s.footerFloat}>
          <button
            style={{
              ...s.btnEnviar,
              opacity: envioBloqueado ? 0.55 : 1,
              margin: 0,
            }}
            onClick={handleEnviar}
            disabled={envioBloqueado}
          >
            {textoBotonEnviar}
          </button>
          {mutation.isError && (
            <p style={s.footerError}>
              {mutation.error?.message || "Error al enviar. Intentá de nuevo."}
            </p>
          )}
        </div>
      )}
    </Pantalla>
  );
}
