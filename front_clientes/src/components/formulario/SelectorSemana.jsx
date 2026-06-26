import { useRef, useEffect } from "react";
import {
  lunesActualISO,
  semanaPermitePedido,
  sumarSemanasISO,
} from "./helpers.js";
import { s } from "./styles.js";

export default function SelectorSemana({ menus, selIdx, onChange }) {
  const tabsRef = useRef([]);

  useEffect(() => {
    tabsRef.current[selIdx]?.scrollIntoView({
      behavior: "smooth",
      inline: "center",
      block: "nearest",
    });
  }, [selIdx, menus.length]);

  return (
    <div style={s.selectorSemanaWrap}>
      <button
        type="button"
        aria-label="Semana anterior"
        onClick={() => onChange(Math.max(0, selIdx - 1))}
        disabled={selIdx === 0}
        style={{ ...s.selectorArrow, opacity: selIdx === 0 ? 0.25 : 1 }}
      >
        ‹
      </button>
      <div style={s.selectorSemana}>
        {menus.map((m, i) => {
          const fecha = m.menu?.fecha_inicio?.split("T")[0];
          let rango = "Semana";
          let etiqueta = "Semana";
          let etiquetaCorta = "Semana";
          if (fecha) {
            const [y, mo, d] = fecha.split("-").map(Number);
            const lunes = new Date(y, mo - 1, d);
            const domingo = new Date(y, mo - 1, d + 6);
            rango = `${lunes.getDate()}/${lunes.getMonth() + 1}–${domingo.getDate()}/${domingo.getMonth() + 1}`;
            const actual = lunesActualISO();
            const anterior = sumarSemanasISO(actual, -1);
            const siguiente = sumarSemanasISO(actual, 1);
            if (fecha === actual) {
              etiqueta = "Semana actual";
              etiquetaCorta = "Actual";
            } else if (fecha === anterior) {
              etiqueta = "Semana anterior";
              etiquetaCorta = "Anterior";
            } else if (fecha === siguiente) {
              etiqueta = "Próxima semana";
              etiquetaCorta = "Próxima";
            } else etiqueta = `Semana del ${rango}`;
          }
          const abierta = semanaPermitePedido(m);
          const activo = selIdx === i;
          return (
            <button
              key={i}
              ref={(el) => (tabsRef.current[i] = el)}
              onClick={() => onChange(i)}
              title={`${etiqueta} (${rango})`}
              style={{
                ...s.selectorTab,
                ...(activo ? s.selectorTabActivo : {}),
              }}
            >
              <span
                style={{
                  display: "block",
                  fontSize: 10,
                  marginBottom: 4,
                  fontWeight: 700,
                  color: abierta ? "#166534" : "#6b7280",
                }}
              >
                {abierta ? "Abierta" : "Cerrada"}
              </span>
              <span
                style={{
                  display: "block",
                  fontSize: 13,
                  fontWeight: 800,
                  lineHeight: 1.2,
                }}
              >
                {etiquetaCorta}
              </span>
              <span
                style={{
                  display: "block",
                  fontSize: 11,
                  fontWeight: 600,
                  marginTop: 2,
                  opacity: 0.85,
                }}
              >
                {rango}
              </span>
            </button>
          );
        })}
      </div>
      <button
        type="button"
        aria-label="Semana siguiente"
        onClick={() => onChange(Math.min(menus.length - 1, selIdx + 1))}
        disabled={selIdx >= menus.length - 1}
        style={{
          ...s.selectorArrow,
          opacity: selIdx >= menus.length - 1 ? 0.25 : 1,
        }}
      >
        ›
      </button>
    </div>
  );
}
