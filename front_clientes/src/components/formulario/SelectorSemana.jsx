import { useRef, useEffect } from 'react';
import { lunesActualISO, sumarSemanasISO } from './helpers.js';
import { s } from './styles.js';

export default function SelectorSemana({ menus, selIdx, onChange }) {
  const tabsRef = useRef([]);

  useEffect(() => {
    tabsRef.current[selIdx]?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
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
          const fecha = m.menu?.fecha_inicio?.split('T')[0];
          let rango = 'Semana';
          let etiqueta = 'Semana';
          if (fecha) {
            const [y, mo, d] = fecha.split('-').map(Number);
            const lunes = new Date(y, mo - 1, d);
            const domingo = new Date(y, mo - 1, d + 6);
            rango = `${lunes.getDate()}/${lunes.getMonth() + 1}–${domingo.getDate()}/${domingo.getMonth() + 1}`;
            const actual = lunesActualISO();
            const anterior = sumarSemanasISO(actual, -1);
            const siguiente = sumarSemanasISO(actual, 1);
            if (fecha === actual) etiqueta = 'Semana actual';
            else if (fecha === anterior) etiqueta = 'Semana anterior';
            else if (fecha === siguiente) etiqueta = 'Próxima semana';
            else etiqueta = `Semana del ${rango}`;
          }
          const abierta = m.disponible && !m.limiteEmpresa?.vencido;
          const activo = selIdx === i;
          return (
            <button
              key={i}
              ref={el => tabsRef.current[i] = el}
              onClick={() => onChange(i)}
              style={{ ...s.selectorTab, ...(activo ? s.selectorTabActivo : {}) }}
            >
              <span style={{ display: 'block', fontSize: 11, marginBottom: 2 }}>
                {abierta ? '🟢 Abierta' : '🔒 Cerrada'}
              </span>
              <span style={{ display: 'block', fontSize: 13, fontWeight: 800 }}>
                {etiqueta}
              </span>
              {['Semana actual', 'Semana anterior', 'Próxima semana'].includes(etiqueta) && (
                <span style={{ display: 'block', fontSize: 11, fontWeight: 600, marginTop: 1, opacity: 0.8 }}>
                  {rango}
                </span>
              )}
            </button>
          );
        })}
      </div>
      <button
        type="button"
        aria-label="Semana siguiente"
        onClick={() => onChange(Math.min(menus.length - 1, selIdx + 1))}
        disabled={selIdx >= menus.length - 1}
        style={{ ...s.selectorArrow, opacity: selIdx >= menus.length - 1 ? 0.25 : 1 }}
      >
        ›
      </button>
    </div>
  );
}
