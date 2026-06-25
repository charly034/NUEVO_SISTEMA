import { DIAS_LABEL } from "../../utils/dias.js";
import { sStep } from "./styles.js";

export default function StepperProgreso({
  dias,
  diasSinServicio,
  noAsiste,
  selecciones,
  diaActivo,
  onDia,
}) {
  const activos = dias.filter(
    ({ dia, bloqueado }) =>
      !bloqueado && !diasSinServicio.has(dia) && !noAsiste[dia],
  );
  const completados = activos.filter(({ dia }) => {
    const sel = selecciones[dia];
    return sel?.plato_id && !(sel?.tiene_guarnicion && !sel?.guarnicion_id);
  }).length;
  const hayWarning = activos.some(({ dia }) => {
    const sel = selecciones[dia];
    return sel?.plato_id && sel?.tiene_guarnicion && !sel?.guarnicion_id;
  });
  const pct = activos.length
    ? Math.round((completados / activos.length) * 100)
    : 0;
  const barColor = hayWarning
    ? "#f59e0b"
    : pct === 100
      ? "var(--verde)"
      : "var(--verde)";

  return (
    <div style={sStep.wrap}>
      <div style={sStep.row}>
        <div style={sStep.dots}>
          {dias.map(({ dia, bloqueado }) => {
            const sinServicio = diasSinServicio.has(dia);
            const ausente = !!noAsiste[dia];
            const sel = selecciones[dia];
            const faltaG =
              sel?.plato_id && sel?.tiene_guarnicion && !sel?.guarnicion_id;
            const ok =
              !bloqueado &&
              !sinServicio &&
              !ausente &&
              sel?.plato_id &&
              !faltaG;
            const activo = diaActivo === dia;
            const inactivo = bloqueado || sinServicio || ausente;
            return (
              <button
                key={dia}
                onClick={() => !inactivo && onDia(dia)}
                title={DIAS_LABEL[dia]}
                style={{
                  ...sStep.dot,
                  ...(ok ? sStep.dotOk : {}),
                  ...(faltaG ? sStep.dotWarn : {}),
                  ...(activo ? sStep.dotActivo : {}),
                  ...(inactivo ? sStep.dotInactivo : {}),
                }}
              >
                <span
                  style={{
                    fontSize: 9,
                    fontWeight: 800,
                    color: ok
                      ? "#fff"
                      : faltaG
                        ? "#92400e"
                        : activo
                          ? "var(--verde)"
                          : "#9ca3af",
                  }}
                >
                  {DIAS_LABEL[dia].slice(0, 1)}
                </span>
              </button>
            );
          })}
        </div>
        <span style={sStep.pct}>
          {completados}/{activos.length}
        </span>
      </div>
      <div style={sStep.track}>
        <div
          style={{ ...sStep.fill, width: `${pct}%`, background: barColor }}
        />
      </div>
    </div>
  );
}
