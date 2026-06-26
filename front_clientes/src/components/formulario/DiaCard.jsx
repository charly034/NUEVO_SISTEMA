import { useState, useEffect, useRef, forwardRef } from "react";
import { formatFecha } from "../../utils/dates.js";
import { DIAS_LABEL } from "../../utils/dias.js";
import { s } from "./styles.js";
import OpcionBtn from "./OpcionBtn.jsx";

export function Pantalla({ children, noScroll }) {
  if (noScroll) {
    return (
      <div
        style={{
          maxWidth: 560,
          margin: "0 auto",
          height: "100dvh",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          padding: "clamp(6px, 1.4dvh, 10px) clamp(8px, 3vw, 14px) 0",
          boxSizing: "border-box",
        }}
      >
        {children}
        <div style={{ flexShrink: 0, height: 66 }} />
      </div>
    );
  }
  return (
    <div style={{ maxWidth: 560, margin: "0 auto", padding: "10px 14px 74px" }}>
      {children}
    </div>
  );
}

export function EstadoFooter({ texto, destacado }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <div
        style={{
          ...s.footerEstado,
          ...(destacado ? s.footerEstadoWarning : {}),
        }}
      >
        {texto}
      </div>
    </div>
  );
}

const DiaCard = forwardRef(function DiaCard(
  {
    dia,
    fecha,
    variablesDia,
    fijosDia,
    seleccion,
    guarniciones,
    onElegir,
    onGuarnicion,
    onNotas,
    bloqueado,
    bloqueadoTexto,
    noAsiste,
    onToggleAsiste,
    expandido,
    onToggleExpand,
  },
  ref,
) {
  const [mostrarNota, setMostrarNota] = useState(false);
  const guarnicionRef = useRef(null);

  useEffect(() => {
    const hayPendiente =
      seleccion?.plato_id &&
      seleccion?.tiene_guarnicion &&
      !seleccion?.guarnicion_id;
    if (hayPendiente && expandido && guarnicionRef.current) {
      const t = setTimeout(() => {
        guarnicionRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "nearest",
        });
      }, 120);
      return () => clearTimeout(t);
    }
  }, [
    seleccion?.plato_id,
    seleccion?.tiene_guarnicion,
    seleccion?.guarnicion_id,
    expandido,
  ]);

  if (bloqueado) {
    return (
      <div
        ref={ref}
        style={{ ...s.diaCard, opacity: 0.5, background: "#f9f9f9" }}
      >
        <div
          style={{
            padding: "14px 16px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div>
            <span style={{ fontWeight: 700, fontSize: 16 }}>
              {DIAS_LABEL[dia]}
            </span>
            <span style={{ color: "var(--subtexto)", fontSize: 13 }}>
              {" "}
              {formatFecha(fecha)}
            </span>
            {seleccion?.plato_id && (
              <p style={{ fontSize: 13, color: "#555", marginTop: 4 }}>
                ✓ {seleccion.plato_nombre}
              </p>
            )}
          </div>
          <span
            style={{
              fontSize: 12,
              color: "var(--subtexto)",
              background: "#eee",
              borderRadius: 8,
              padding: "4px 9px",
            }}
          >
            🔒 {bloqueadoTexto}
          </span>
        </div>
      </div>
    );
  }

  if (noAsiste) {
    return (
      <div
        ref={ref}
        style={{ ...s.diaCard, background: "#fff5f5", borderColor: "#fecaca" }}
      >
        <div
          style={{
            padding: "14px 16px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontWeight: 700, fontSize: 17 }}>
                {DIAS_LABEL[dia]}
              </span>
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: "#dc2626",
                  background: "#fee2e2",
                  borderRadius: 20,
                  padding: "2px 10px",
                }}
              >
                No necesitás vianda
              </span>
            </div>
            <span style={{ color: "#9ca3af", fontSize: 13 }}>
              {formatFecha(fecha)}
            </span>
          </div>
          <button onClick={onToggleAsiste} style={s.chipVerde}>
            Pedir vianda este día
          </button>
        </div>
      </div>
    );
  }

  const platosOrdenados = [
    ...variablesDia.map((p) => ({ ...p, esEspecial: true })),
    ...fijosDia.map((p) => ({ ...p, esEspecial: false })),
  ];

  const hayGuarnicionPendiente =
    seleccion?.plato_id &&
    seleccion?.tiene_guarnicion &&
    !seleccion?.guarnicion_id;

  return (
    <div
      ref={ref}
      style={{
        ...s.diaCard,
        ...(expandido ? s.diaCardExpandida : {}),
        ...(seleccion?.plato_id && !hayGuarnicionPendiente
          ? { borderColor: "var(--verde)" }
          : {}),
        ...(hayGuarnicionPendiente ? { borderColor: "#f59e0b" } : {}),
      }}
    >
      <button style={s.diaHeader} onClick={onToggleExpand}>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 3,
            flex: 1,
            minWidth: 0,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontWeight: 700, fontSize: 17 }}>
              {DIAS_LABEL[dia]}
            </span>
            <span style={{ color: "var(--subtexto)", fontSize: 14 }}>
              {formatFecha(fecha)}
            </span>
          </div>
          {seleccion?.plato_id &&
            (() => {
              if (hayGuarnicionPendiente) {
                return (
                  <span style={s.selBadgeWarning}>
                    ⚠ Falta elegir guarnición
                  </span>
                );
              }
              const nombrePlato =
                (seleccion.plato_nombre?.length ?? 0) > 26
                  ? seleccion.plato_nombre.slice(0, 26) + "…"
                  : (seleccion.plato_nombre ?? "");
              const guarnicion = guarniciones?.find(
                (g) => g.id === seleccion.guarnicion_id,
              );
              return (
                <span style={s.selBadge}>
                  ✓ {nombrePlato}
                  {guarnicion ? ` · ${guarnicion.nombre}` : ""}
                </span>
              );
            })()}
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            flexShrink: 0,
          }}
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleAsiste();
            }}
            style={seleccion?.plato_id ? s.chipNoVoySuave : s.chipNoVoy}
          >
            ✕ No necesito
          </button>
          <span style={{ color: "var(--subtexto)", fontSize: 18 }}>
            {expandido ? "▲" : "▼"}
          </span>
        </div>
      </button>

      <div
        style={{
          maxHeight: expandido ? "100%" : 0,
          flex: expandido ? 1 : "initial",
          minHeight: 0,
          opacity: expandido ? 1 : 0,
          overflow: "hidden",
          transition: "max-height 340ms ease, opacity 220ms ease",
        }}
      >
        <div style={s.diaContenido}>
          <div
            style={{
              flex: 1,
              minHeight: 0,
              overflowY: "auto",
              display: "flex",
              flexDirection: "column",
              gap: 8,
              paddingRight: 2,
            }}
          >
            {platosOrdenados.length === 0 ? (
              <p
                style={{
                  color: "var(--subtexto)",
                  fontSize: 14,
                  padding: "8px 0",
                }}
              >
                No hay platos disponibles para este día.
              </p>
            ) : (
              platosOrdenados.map((p, i) => {
                const key = p.esEspecial
                  ? `esp-${p.opcion ?? i}`
                  : `fijo-${p.plato_id}`;
                const sepAntes =
                  !p.esEspecial && i > 0 && platosOrdenados[i - 1]?.esEspecial;
                const esteSeleccionado =
                  seleccion?.plato_id === p.plato_id &&
                  seleccion?.opcion ===
                    (p.esEspecial ? (p.opcion ?? null) : null);
                return (
                  <div key={key}>
                    {sepAntes && variablesDia.length > 0 && (
                      <div style={s.separadorFijos}>
                        <span style={s.separadorTexto}>Platos fijos</span>
                      </div>
                    )}
                    <OpcionBtn
                      plato={p}
                      badge={
                        p.esEspecial ? `Opción ${p.opcion ?? ""}`.trim() : null
                      }
                      seleccionado={esteSeleccionado}
                      guarnicionId={
                        esteSeleccionado ? seleccion?.guarnicion_id : null
                      }
                      guarniciones={p.tiene_guarnicion ? guarniciones : []}
                      onElegir={() =>
                        onElegir(p, p.esEspecial ? (p.opcion ?? null) : null)
                      }
                      onGuarnicion={(gId) => onGuarnicion(gId)}
                      guarnicionRef={esteSeleccionado ? guarnicionRef : null}
                    />
                  </div>
                );
              })
            )}
          </div>

          {/* Nota opcional */}
          {seleccion?.plato_id && (
            <div style={{ marginTop: 12 }}>
              {!mostrarNota && !seleccion.notas ? (
                <button
                  onClick={() => setMostrarNota(true)}
                  style={{
                    fontSize: 14,
                    color: "var(--subtexto)",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    padding: 0,
                    textDecoration: "underline",
                  }}
                >
                  + Agregar nota (sin sal, sin cebolla…)
                </button>
              ) : (
                <input
                  autoFocus={mostrarNota && !seleccion.notas}
                  style={s.inputNotas}
                  value={seleccion.notas || ""}
                  onChange={(e) => onNotas(e.target.value)}
                  placeholder="Sin sal, sin cebolla..."
                />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

export default DiaCard;
