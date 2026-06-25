import { DIAS_LABEL } from "../../utils/dias.js";
import { ORDEN_DIAS } from "./helpers.js";
import { sHome } from "./styles.js";

export function CardHeader({ icono, titulo, sub, colorTitulo, colorSub }) {
  return (
    <div style={sHome.cardHeader}>
      <span style={sHome.cardIcono}>{icono}</span>
      <div>
        <div style={{ ...sHome.cardTitulo, color: colorTitulo }}>{titulo}</div>
        {sub && <div style={{ ...sHome.cardSub, color: colorSub }}>{sub}</div>}
      </div>
    </div>
  );
}

export function SemanaCard({
  children,
  variante = "menu",
  accion,
  textoAccion,
}) {
  const esOk = variante === "ok";
  return (
    <div style={{ ...sHome.card, ...(esOk ? sHome.cardOk : {}) }}>
      {children}
      {accion && (
        <button
          onClick={accion}
          style={{ ...sHome.btnAccion, ...(esOk ? sHome.btnAccionOk : {}) }}
        >
          {textoAccion}
        </button>
      )}
    </div>
  );
}

export function PedidoConfirmadoCard({ dias, textoResumen, onModificar }) {
  return (
    <SemanaCard
      variante="ok"
      accion={onModificar}
      textoAccion="Modificar pedido"
    >
      <CardHeader
        icono="✅"
        titulo="Pedido confirmado"
        sub={textoResumen}
        colorTitulo="#15803d"
        colorSub="#166534"
      />
      <div style={sHome.diasResumen}>
        {dias.map(({ dia, item }) => (
          <div
            key={dia}
            style={{
              ...sHome.diaFila,
              ...(!item ? sHome.diaFilaSinVianda : {}),
            }}
          >
            <span
              style={{
                ...sHome.diaLabel,
                ...(!item ? sHome.diaLabelSinVianda : {}),
              }}
            >
              {DIAS_LABEL[dia]}
            </span>
            <div>
              {item ? (
                <>
                  <div style={sHome.diaPlato}>{item.plato_nombre}</div>
                  {item.guarnicion_nombre && (
                    <div style={sHome.diaGuarnicion}>
                      + {item.guarnicion_nombre}
                    </div>
                  )}
                </>
              ) : (
                <span style={sHome.diaSinVianda}>No pedís vianda</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </SemanaCard>
  );
}

export function MenuSemanalCard({ menu, textoResumen, onComenzar }) {
  const variables = menu?.variables || [];
  const porDia = ORDEN_DIAS.slice(0, 5).map((dia) => {
    const platos = variables.filter((p) => p.dia === dia);
    return { dia, platos };
  });
  return (
    <SemanaCard accion={onComenzar} textoAccion="Hacé tu pedido">
      <CardHeader
        icono="📅"
        titulo="Menú de la semana"
        sub={textoResumen}
        colorTitulo="#1e3a8a"
        colorSub="#475569"
      />
      <div style={sHome.diasResumen}>
        {porDia.map(({ dia, platos }) => (
          <div
            key={dia}
            style={{
              ...sHome.diaFila,
              ...(platos.length === 0 ? sHome.diaFilaSinVianda : {}),
            }}
          >
            <span
              style={{
                ...sHome.diaLabel,
                ...(platos.length === 0 ? sHome.diaLabelSinVianda : {}),
              }}
            >
              {DIAS_LABEL[dia]}
            </span>
            <div style={{ minWidth: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: 1 }}>
              {platos.length > 0 ? platos.map((p, i) => (
                <div
                  key={p.plato_id ?? i}
                  style={{
                    ...sHome.diaPlato,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {p.plato_nombre}
                </div>
              )) : (
                <span style={sHome.diaSinVianda}>Sin especial</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </SemanaCard>
  );
}

export function MenuNoDisponibleCard({ mensaje }) {
  return (
    <SemanaCard>
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 10,
          padding: "0 24px",
        }}
      >
        <span style={{ fontSize: 36, lineHeight: 1 }}>⏳</span>
        <span style={sHome.noMenuMensaje}>{mensaje}</span>
      </div>
    </SemanaCard>
  );
}
