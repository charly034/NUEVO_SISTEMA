import { useState } from 'react';
import { s, sG } from './styles.js';

export default function OpcionBtn({ plato, badge, seleccionado, guarnicionId, guarniciones, onElegir, onGuarnicion, guarnicionRef }) {
  // Comienza expandido si no hay guarnición elegida; colapsado si ya hay una
  const [guarnicionExpanded, setGuarnicionExpanded] = useState(!guarnicionId);

  const mostrarGuarniciones =
    (seleccionado && plato.tiene_guarnicion && !guarnicionId) ||
    guarnicionExpanded;

  const handleGuarnicion = (gId) => {
    onGuarnicion(gId);
    setGuarnicionExpanded(false);
  };

  const guarnicionElegida = guarnicionId
    ? guarniciones?.find(g => g.id === guarnicionId)
    : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      <button
        style={{
          ...s.opcionBtn,
          ...(seleccionado ? {
            borderColor: 'var(--verde)',
            background: 'var(--verde-bg)',
            ...(plato.tiene_guarnicion ? { borderBottomLeftRadius: 0, borderBottomRightRadius: 0, borderBottom: 'none' } : {}),
          } : {}),
        }}
        onClick={onElegir}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {badge && <span style={s.badge}>{badge}</span>}
          <span style={{ fontWeight: 600, fontSize: 16 }}>{plato.plato_nombre}</span>
        </div>
        {!seleccionado && plato.tiene_guarnicion && (
          <span style={{ fontSize: 13, color: 'var(--subtexto)', fontStyle: 'italic' }}>Requiere guarnición</span>
        )}
      </button>

      {seleccionado && plato.tiene_guarnicion && (
        mostrarGuarniciones ? (
          <div ref={guarnicionRef} style={sG.panel}>
            <span style={sG.label}>Seleccioná tu guarnición</span>
            <div style={sG.chips}>
              {guarniciones.map(g => (
                <button
                  key={g.id}
                  style={{ ...sG.chip, ...(guarnicionId === g.id ? sG.chipSel : {}) }}
                  onClick={() => handleGuarnicion(g.id)}
                >
                  {g.nombre}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <button
            onClick={() => setGuarnicionExpanded(true)}
            style={sG.panelColapsado}
          >
            <span style={{ fontSize: 13, color: '#4a7c59', fontWeight: 500 }}>
              🥗 {guarnicionElegida ? guarnicionElegida.nombre : 'Elegir guarnición'}
            </span>
            <span style={{ fontSize: 11, color: 'var(--subtexto)' }}>▼</span>
          </button>
        )
      )}
    </div>
  );
}
