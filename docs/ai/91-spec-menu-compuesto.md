# Spec ejecutable — Menú base vs Menú compuesto (rediseño de dominio v2)

> ⚠️ **DIFERIDO por /plan-eng-review (2026-07-18).** La revisión de ingeniería (con voz externa independiente) concluyó que el flip completo es sobre-inversión de riesgo hoy: gasta el mayor presupuesto de riesgo (flip de pedidos/cocina, ~29 archivos con `vianda`, maquinaria de materialización/rotación) para llegar a paridad + auto-create, con la única capacidad nueva (combo multi-plato) diferida igual. **Decisión del usuario: hacer los golpes baratos ahora (ver "## Trabajo inmediato") y DIFERIR este rewrite** hasta que el multi-plato sea una necesidad real. Esta spec queda como **diseño de referencia** para ese momento.
>
> **Si se resucita, primero reconciliar los hallazgos del eng review:** (1) el DDL todavía tiene `disponibilidad`/`dia_fijo` en `menu_compuesto` — sacarlos (fijo/especial vive en la celda; auto-fill = copiar semana anterior); (2) blast radius real ~29 archivos — faltan `vista-semanal` (resolver propio), `semana-opciones`, `menu-items`, `grupos-rotativos`, `configuracion`, `finanzas`; (3) `materializarFijosMenu` + rotación (`categoria_grupo`) escriben las columnas que se flipean + tablas de anclaje (`menu_semanal_fijos_vianda`, `categoria_defaults_vianda`, `menu_semanal_fijos_kilo`) — reescribir y reconciliar con el auto-fill; (4) `pedido_items` debe snapshotear el/los principal(es) o el multi-plato obliga a re-flipear la fila (trabajo tirado); (5) para el corazón (0..1 guarnición + 0..1 salsa) columnas sobre `menu_compuesto` son más simples que la tabla genérica `menu_compuesto_componente` — esa tabla solo se justifica cuando llega N-principales; (6) el override standing por empresa pierde la guarda anti-rancio (`emo.plato_id_origen = msd.plato_id`) del override por celda actual; (7) paridad F2 debe ser POR EMPRESA (override aplicado), no solo el slot base.

## Trabajo inmediato (post eng-review 2026-07-18) — esto SÍ se hace ahora

Resuelve los dos dolores diarios sin tocar la zona de alto riesgo:

1. **Auto-crear vianda default al crear un plato** (mata "no hay vianda asociada"). En `API_LA_QUINTA/src/modules/platos/platos.service.js::createPlato`, tras insertar el plato, crear en la MISMA transacción una vianda general (`viandas`: `plato_id`, `empresa_id NULL`, `activo=true`, `nombre_generado=true`). Así el plato queda usable en el diseño de menú al instante. Test http-db: crear plato → aparece usable en `menus-semanales` sin el error "no tiene una vianda activa".
2. **Salsa como entidad, sin nuevo build.** La tabla `salsas` + `platos.salsa_modo` ya existen (Fase 1). Uso inmediato: correr el script ya construido `npm run salsas:limpiar-guarniciones` (desactiva las "Salsa …" residuales en `guarniciones`); de ahí en más los platos nuevos usan salsa como componente propio. La separación de salsas embebidas en nombres viejos se hace incremental al editar cada plato — no requiere migración big-bang.

> Estado del rewrite (abajo): DRAFT de spec, generado con /spec el 2026-07-18, DIFERIDO por eng-review. Modelo cerrado en `docs/ai/90-redesign-dominio-borrador.md`. NO implementado.

## Context (por qué)

Hoy, para ofrecer un plato en un menú semanal, el plato necesita una **vianda asociada** (tabla `viandas`): al armar el menú el admin se topa con "no hay vianda asociada" y tiene que ir a crearla aparte → **doble trabajo recurrente**. Además el modelo actual no permite **combos de 2 platos** ("budín bicolor + bomba de papa") y modela la **salsa de forma inconsistente** (a veces dentro del nombre del plato, a veces como `salsa_modo` en `platos`). No está en producción, así que es el momento más barato para rehacerlo bien.

## Current State (verificado 2026-07-18, DB de test migrada a `1719000081000`)

El modelo actual ya reifica combinaciones, pero acopladas a 1 plato y sin nombre de catálogo navegable:

- `viandas` (11 cols): `id, plato_id NOT NULL, guarnicion_id, salsa_id, salsa_libre BOOL, empresa_id, nombre_vianda, nombre_generado BOOL, activo, created_at, updated_at`. Es, de hecho, un "compuesto de 1 plato" con override por empresa embebido (`empresa_id`) y auto-nombre (`nombre_generado`).
- `platos` (cols de composición): `guarnicion_modo, guarnicion_fija_id, salsa_modo, salsa_fija_id, nombre_vianda, tiene_guarnicion, disponible_vianda, tipo, disponibilidad (especial/fijo_dia/siempre), dia_fijo`.
- `menu_semanal_dias` (14 cols): `id, menu_semanal_id, dia, opcion, plato_id, categoria_id, vianda_id, guarnicion_modo_override, guarnicion_fija_override_id, salsa_modo_override, salsa_fija_override_id, disponible_por_kilo, origen_categoria_grupo_id, created_at`.
- `menu_semanal_dia_empresa_override` (mig. `1719000080000`, 13 cols): override de composición por (menu, categoria, dia, opcion, empresa) — el que se reemplaza por override standing a nivel compuesto.
- `pedido_items`: referencia `plato_id, guarnicion_id, salsa_id, opcion, sin_pedido` (NO tiene `vianda_id`).
- `construirTextoItem(item)` en `API_LA_QUINTA/src/modules/pedidos/pedidos.service.js:227` ya compone el nombre dinámico (plato + guarnición + salsa). Es la base del auto-nombre del compuesto.
- Categorías de sistema (`especiales`, `fijos-x-dia`, `fijos-de-siempre`, `guarniciones`, `salsas`) + `materializarFijosMenu` en `src/modules/categorias/categorias.repository.js`.

| Entidad actual | Rol en el modelo nuevo |
|---|---|
| `platos` | Menú **base** (átomo). Se le quitan los modos guarnición/salsa. |
| `viandas` | Se **subsume** en `menu_compuesto` (backfill: 1 vianda/plato-con-modo → 1 compuesto de 1 base). Se dropea al final. |
| `menu_semanal_dia_empresa_override` | Se **reemplaza** por `menu_compuesto_empresa_override` (standing). Se dropea. |
| `menu_semanal_dias.plato_id/vianda_id/*_override` | Se reemplaza por `menu_semanal_dias.menu_compuesto_id`. |
| `pedido_items.plato_id/guarnicion_id/salsa_id` | Pasa a `menu_compuesto_id` + resueltos elegidos. |

## Proposed Change — modelo de datos

### Tablas nuevas (DDL objetivo)

```sql
CREATE TYPE menu_componente_rol AS ENUM ('principal', 'guarnicion', 'salsa');
CREATE TYPE menu_componente_modo AS ENUM ('fijo', 'libre');  -- principal siempre 'fijo'

CREATE TABLE menu_compuesto (
  id              SERIAL PRIMARY KEY,
  nombre_override VARCHAR(200) NULL,   -- NULL = nombre auto (construirTextoItem)
  foto_override   VARCHAR NULL,
  disponibilidad  plato_disponibilidad NOT NULL DEFAULT 'especial', -- reusa el enum de platos
  dia_fijo        dia_semana NULL,     -- solo si disponibilidad='fijo_dia'
  activo          BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE menu_compuesto_componente (
  id                SERIAL PRIMARY KEY,
  menu_compuesto_id INTEGER NOT NULL REFERENCES menu_compuesto(id) ON DELETE CASCADE,
  rol               menu_componente_rol NOT NULL,
  modo              menu_componente_modo NOT NULL,
  plato_id          INTEGER NULL REFERENCES platos(id),        -- rol='principal'
  guarnicion_id     INTEGER NULL REFERENCES guarniciones(id),  -- rol='guarnicion' AND modo='fijo'
  salsa_id          INTEGER NULL REFERENCES salsas(id),        -- rol='salsa' AND modo='fijo'
  orden             INTEGER NOT NULL DEFAULT 0,
  CHECK (rol <> 'principal' OR (modo = 'fijo' AND plato_id IS NOT NULL AND guarnicion_id IS NULL AND salsa_id IS NULL)),
  CHECK (rol <> 'guarnicion' OR (plato_id IS NULL AND salsa_id IS NULL AND (modo='libre' OR guarnicion_id IS NOT NULL))),
  CHECK (rol <> 'salsa' OR (plato_id IS NULL AND guarnicion_id IS NULL AND (modo='libre' OR salsa_id IS NOT NULL)))
);
-- a lo sumo 1 componente rol='guarnicion' y 1 rol='salsa' por compuesto:
CREATE UNIQUE INDEX menu_compuesto_un_guarnicion_uidx ON menu_compuesto_componente (menu_compuesto_id) WHERE rol='guarnicion';
CREATE UNIQUE INDEX menu_compuesto_un_salsa_uidx ON menu_compuesto_componente (menu_compuesto_id) WHERE rol='salsa';

CREATE TABLE menu_compuesto_empresa_override (
  id                SERIAL PRIMARY KEY,
  menu_compuesto_id INTEGER NOT NULL REFERENCES menu_compuesto(id) ON DELETE CASCADE,
  empresa_id        INTEGER NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  guarnicion_modo   menu_componente_modo NULL,   -- pisa el componente guarnición
  guarnicion_id     INTEGER NULL REFERENCES guarniciones(id),
  salsa_modo        menu_componente_modo NULL,
  salsa_id          INTEGER NULL REFERENCES salsas(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (menu_compuesto_id, empresa_id)
);

ALTER TABLE menu_semanal_dias ADD COLUMN menu_compuesto_id INTEGER NULL REFERENCES menu_compuesto(id);
ALTER TABLE pedido_items      ADD COLUMN menu_compuesto_id INTEGER NULL REFERENCES menu_compuesto(id);
```

### Resolución (cómo se lee un compuesto para una empresa)
1. Componentes del compuesto → base(s) + guarnición(modo/ref) + salsa(modo/ref).
2. Si existe `menu_compuesto_empresa_override(compuesto, empresa)`, sus campos no-NULL pisan el modo/ref de guarnición y/o salsa.
3. El **nombre** se compone de esa resolución con `construirTextoItem` (generalizado a N principales), salvo `nombre_override`.

## Migración por fases (F0–F6)

Numeración desde `1719000082000` (última actual: `1719000081000_configuracion.js`). Migraciones con `node-pg-migrate` (`npm run migrate:create`). Gate por fase: `npm test` secuencial verde + paridad verde antes de cada flip.

- **F0 · Schema aditivo** — `1719000082000_menu-compuesto.js` (las 3 tablas + enums) y `1719000083000_menu-compuesto-fks-nullable.js` (`menu_compuesto_id` en `menu_semanal_dias` y `pedido_items`). Cero cambio de comportamiento.
- **F1 · Backfill del catálogo** — script `scripts/backfill-compuestos.js`: por cada `plato` con `guarnicion_modo/salsa_modo` (o cada `vianda` activa) → un `menu_compuesto` de 1 principal + componentes según los modos. Auto-crear el compuesto default al crear un plato: nuevo hook en `platos.service.js::createPlato`. **Fusiona con `seed:consolidado`**: el seed pasa a sembrar compuestos. Requiere poblar `salsas` de verdad y descomponer salsas de nombres (fuente: `src/database/seeds/data/decomposicion.json`).
- **F2 · Backfill de menús + paridad** — apuntar `menu_semanal_dias.menu_compuesto_id` al compuesto equivalente. Test `test/compuesto-paridad.db.test.js`: leer el slot por el path viejo (plato+modo+vianda+override) == leerlo por el compuesto, sobre TODOS los `menu_semanal_dias` reales (patrón `categorias-fase-b-paridad`).
- **F3 · Flip backend** — `menus-semanales`, `pedidos` (`pedidos.repository.js`, `pedidos.service.js`), `cocina` leen del compuesto. `construirTextoItem` generalizado a N principales. `pedido_items` pasa a `menu_compuesto_id` + `guarnicion_id`/`salsa_id` resueltos (snapshot).
- **F4 · UI admin** (`front_menu/src/pages/MenuResumen.jsx` + hooks) — CRUD del catálogo de compuestos; armado semanal por compuesto; override standing por empresa. UI intuitiva (ver "UX" abajo).
- **F5 · UI cliente** (`front_clientes/src/components/pedido/WeeklyOrderView.jsx`) — elegir compuesto por día; si es a elección, elegir guarnición/salsa dentro.
- **F6 · Limpieza** — drop `viandas`, `menu_semanal_dia_empresa_override`, columnas `guarnicion_modo/salsa_modo/guarnicion_fija_id/salsa_fija_id/nombre_vianda` de `platos`, `plato_id/vianda_id/*_override` de `menu_semanal_dias`, `plato_id/guarnicion_id/salsa_id` de `pedido_items` (una vez todo migrado y verde).

## API (contratos nuevos, `/api/v1`)

- `GET/POST/PATCH/DELETE /api/v1/menu-compuestos` — CRUD del catálogo. POST body: `{ componentes: [{rol, modo, plato_id?/guarnicion_id?/salsa_id?}], disponibilidad?, dia_fijo?, nombre_override?, foto_override? }`.
- `GET/PUT /api/v1/menu-compuestos/:id/empresa-override/:empresaId` — override standing por empresa (reemplaza el endpoint de excepción por celda de `menu-items`).
- `POST /api/v1/menus-semanales/:id/dias` pasa a aceptar `menu_compuesto_id` en vez de `plato_id`.
- `POST/PUT /api/v1/pedidos`: cada item pasa a `{ dia, menu_compuesto_id, guarnicion_id?, salsa_id?, sin_pedido }` (guarnición/salsa solo cuando el compuesto resuelto es "a elección").
- Respuesta de menú cliente (`GET /api/v1/menu/semanas/:semanaId/opciones`): cada opción pasa a exponer `menu_compuesto_id`, `nombre` (auto/override), componentes resueltos para la empresa del token, y flags `guarnicion_a_eleccion`/`salsa_a_eleccion`.

## UX (Simplicidad Radical — ver `docs/ai/ux-admin-prompt.md`)
La UI NO expone "compuesto/componente/rol/modo". El encargado ve "menús":
- Alta de menú = nombre + "¿Lleva guarnición? No/Fija/A elegir" + "¿Lleva salsa?" (mismo patrón). Guardar → usable en cualquier semana.
- Armado semanal = lista por día (como el Excel/Form actual); fijos auto-cargados y editables; agregar especial = buscar y tocar.
- Avanzado (combo multi-plato, override por empresa) por progressive disclosure ("+ combinar dos platos", "excepción para una empresa"). Mockups de referencia en el chat de diseño (admin intuitivo + cocina).

## Testing Plan

| Layer | Qué | Aprox |
|---|---|---|
| Unit | `construirTextoItem` con N principales + a-elección; resolución de override empresa | +6 |
| Integración (http-db) | CRUD compuesto; alta de plato auto-crea compuesto; override empresa resuelve; POST pedido con compuesto+resueltos | +8 |
| Paridad (db) | slot viejo == slot por compuesto sobre todos los `menu_semanal_dias` reales (F2) | +1 |
| Cocina (http-db) | conteos agregados por compuesto y por guarnición resuelta | +2 |

## Files Reference

| File | Cambio |
|---|---|
| `src/database/migrations/1719000082000_*`..`1719000087000_*` | F0 tablas, F6 drops |
| `src/modules/menu-compuestos/` (nuevo módulo) | routes/controller/service/validation/repository |
| `src/modules/platos/platos.service.js` | auto-crear compuesto default en createPlato |
| `src/modules/pedidos/pedidos.service.js:227` | `construirTextoItem` a N principales; item→compuesto |
| `src/modules/pedidos/pedidos.repository.js` | leer/guardar `pedido_items.menu_compuesto_id` |
| `src/modules/menus-semanales/*` | slot referencia compuesto |
| `src/modules/cocina/cocina.repository.js` | conteos por compuesto/componente resuelto |
| `scripts/backfill-compuestos.js` (nuevo) | F1 backfill; fusión con seed:consolidado |
| `front_menu/src/pages/MenuResumen.jsx` + hooks | F4 UI admin |
| `front_clientes/src/components/pedido/WeeklyOrderView.jsx` | F5 UI cliente |

## Acceptance Criteria
1. Crear un plato base deja un compuesto usable inmediatamente en el armado semanal, sin paso de "asociar vianda" (0 errores "no hay vianda asociada").
2. Un compuesto de 2 principales ("budín bicolor + bomba de papa") se arma, se ofrece, se pide y se cocina, con nombre auto correcto.
3. Salsa es componente de primera clase: la tabla `salsas` queda poblada; ningún nombre de plato lleva la salsa embebida tras el backfill.
4. Override standing por empresa: el mismo compuesto se resuelve "a elección" para la empresa X y "fija" para las demás, sin duplicar el compuesto.
5. Test de paridad F2 en verde sobre el 100% de `menu_semanal_dias` reales.
6. `npm test` (secuencial) en verde en cada fase; `front_menu`/`front_clientes` lint+build verdes.
7. La UI de alta y de armado no muestra las palabras "compuesto/componente/rol/modo".

## Rollback
No está en producción → si una fase falla, se revierte la migración (`npm run migrate:rollback`) y el commit. F6 (drops) es la única irreversible; se corre recién con F2–F5 verdes y estables.

## Effort (aprox, CC+gstack)
F0 ~1 migración chica · F1 backfill+seed ~el grueso · F2 paridad ~1 test · F3 flip backend (pedidos/cocina, alto riesgo) ~el 2do grueso · F4/F5 UI ~UI + browser QA · F6 drops ~mecánico. Cada fase con su gate de tests.

## Extensibilidad futura (costos / ingredientes) — NO se construye ahora

Objetivo: dejar las tablas base como puntos de enganche limpios para que un futuro módulo `src/modules/costos` (ingredientes + recetas + costeo) se agregue **sumando tablas**, no rehaciendo las del rediseño. NO construir nada de esto todavía (evitar features especulativas); solo diseñar los seams y documentar las extensiones previstas.

**Bosquejo del módulo futuro (referencia, no parte de esta spec):**
- `ingredientes (id, nombre, unidad, costo_por_unidad, ...)` — catálogo de materia prima.
- `receta` / `plato_ingrediente (plato_id, ingrediente_id, cantidad, unidad)` — y análogo para guarniciones/salsas con receta propia.
- Costo de plato/guarnición/salsa = Σ receta. Costo de compuesto = Σ componentes. Costo de producción de un día/semana = Σ sobre `pedido_items`.

**Seams que este rediseño ya deja listos (aditivos por FK, sin tocar nada):**
1. `platos`, `guarniciones`, `salsas` quedan como átomos con id estable y separados (no se fusionan) → la receta cuelga por FK de cada uno.
2. `menu_compuesto_componente` referencia esos ids reales → el costo del compuesto se deriva sumando componentes.
3. `pedido_items` guarda `menu_compuesto_id` + guarnición/salsa resuelta → permite costear lo que realmente se sirvió, incluso histórico.
4. El módulo de costos son tablas nuevas que apuntan a `platos.id`/`guarniciones.id`/`salsas.id`; el rediseño no cambia.

**Columnas RESERVADAS (aditivas a futuro, NO agregar ahora):**
- `pedido_items.costo_snapshot` — congela el costo al momento del pedido, para que el histórico no se mueva si mañana sube un ingrediente.
- `menu_compuesto_componente.cantidad` / `gramaje` — porción de cada componente (150 g de guarnición, etc.) para costear fino. Se puede apoyar en el gramaje ya existente en `planes_comerciales`.

**No colisionar con `finanzas`:** `finanzas` es cobranza (lo que te pagan: pagos, cuenta corriente, `pedidos.importe_total`, `estado_financiero`). Costos es producción (lo que te cuesta hacerlo). Complementarios (costos → margen → precio, y finanzas cobra ese precio). Costos debe ser su propio módulo, separado de `finanzas`.

## Out of Scope
- Modulo de costos/ingredientes en sí (solo se dejan los seams listos; ver "Extensibilidad futura").
- Venta por kilo del Local (sigue fuera del sistema; `plato_disponibilidad_local` intacta).
- Postre/bebida (siguen en el plan comercial, no en el compuesto).
- Override puntual por semana (solo standing por ahora; se suma después si hace falta).
- Reescribir el pipeline alternativo `seed:catalogo-menus` (ya marcado roto).

## Related
- `docs/ai/90-redesign-dominio-borrador.md` (modelo + roadmap + mockups)
- `docs/ai/60-debt.yaml` (`debt-guarniciones-filas-salsa-residuales`, superseded por F1)

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 0 | — | — |
| Codex Review | `/codex review` | Independent 2nd opinion | 0 | — | — |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 1 | pivote estratégico | 4 secciones + voz externa; alcance reducido |
| Design Review | `/plan-design-review` | UI/UX gaps | 0 | — | — |
| DX Review | `/plan-devex-review` | Developer experience gaps | 0 | — | — |

Decisiones tomadas en la revisión: Step 0 → corazón-primero; A1 → fijo/especial en la celda + auto-fill copia semana anterior (sin `disponibilidad` en compuesto); C1 → un solo `resolverCompuestoParaEmpresa` (DRY); P1 → resolver batch (anti N+1); y la **decisión estratégica final → golpes baratos ahora (auto-create vianda + limpieza salsa), DIFERIR el flip completo**.

- **CODEX:** no instalado — voz externa vía subagente Claude (14 hallazgos; los críticos: spec stale vs core-first, blast radius ~29 archivos, maquinaria de fijos/rotación no contemplada, `pedido_items` sin snapshot de principal, sobre-complejidad de la tabla de componentes para el corazón).
- **CROSS-MODEL:** la voz externa y la crítica previa coinciden — el flip completo es sobre-inversión de riesgo ahora. Consenso fuerte → se difiere.
- **VERDICT:** ENG CLEARED — plan revisado; alcance reducido a auto-create vianda + limpieza salsa (bajo riesgo, resuelve el dolor diario). El modelo compuesto queda diferido como diseño de referencia hasta que el multi-plato lo justifique.

NO UNRESOLVED DECISIONS
