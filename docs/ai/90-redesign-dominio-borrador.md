# Borrador — Replanteo del modelo de dominio (en diseño, no implementado)

> **Estado: DRAFT.** Este documento registra decisiones conceptuales tomadas en sesión de diseño, previas a cualquier migración o cambio de código. No es fuente de verdad del sistema en producción — la fuente de verdad del sistema actual sigue siendo `20-modules.yaml`, `30-contracts.yaml` y el código. Se promueve a los docs numerados (`20-modules.yaml`, `30-contracts.yaml`, etc.) recién cuando el modelo se implemente.

> **Por qué existe:** el sistema llegó a "feature-complete" (ver `70-project-history.yaml` / memoria del proyecto) con el próximo hito siendo deploy a producción. El usuario decidió pausar ese plan para repensar el modelo de dominio desde los conceptos más elementales, por etapas: Platos/Vianda/Salsa → Menú → Oferta a Empresas → Clientes → Pedidos.

## Convenciones de este documento
- ✅ = decisión tomada por el usuario en sesión.
- 🟡 = propuesta pendiente de confirmar.
- ❓ = pregunta abierta, no resuelta todavía.

---

## Etapa 1 — Plato / Guarnición / Salsa / Vianda

### Estado actual del sistema (antes del replanteo)
- `platos`: única entidad de comida real. Campos relevantes: `tipo` (fijo/especial/ambos), `tiene_guarnicion`, `canal` (vianda/local/ambos), `guarnicion_modo` (sin_guarnicion/fija/libre), `guarnicion_fija_id`, `nombre_vianda`.
- `guarniciones`: tabla separada (`nombre`, `activo`, `tipo`: caliente/fria).
- **No existe** tabla `salsas` — hoy una salsa es una fila de `guarniciones` con `tipo='caliente'` (ej. "Salsa bolognesa"). Sin distinción de dominio.
- **No existe** "vianda" como composición — hoy "vianda" es: (a) `canal` del plato (envío vs local), (b) `planes_vianda` (plan comercial: gramaje + incluye_postre + incluye_bebida), o (c) sinónimo informal de "pedido de un día". Ninguno agrupa plato+guarnición+salsa.
- El cliente arma su pedido eligiendo plato + guarnición por separado, por día.

### Definiciones nuevas (✅ decidido en sesión)
- **Plato**: unidad de comida principal, con identidad propia (nombre, descripción, alérgenos, foto, vegetariano, etc.). No cambia de fondo respecto a hoy.
- **Guarnición**: acompañamiento sólido (puré, arroz, ensalada). Entidad propia.
- **Salsa**: acompañamiento líquido/untuoso (bolognesa, blanca, hongos). ✅ **Entidad propia, separada de Guarnición** (no una tabla unificada "acompañamientos" con campo tipo — se decidió mantener dos tablas independientes, cada una con su propio ciclo de vida).
- **Vianda**: la composición servida/pedida = Plato + (0 o 1 Guarnición) + (0 o 1 Salsa). ✅ Redefine el término: el uso viejo de "vianda" como canal de envío queda obsoleto y debe renombrarse (🟡 propuesta: `modalidad_entrega` con valores `envio`/`local`/`ambos` — nombre exacto pendiente de confirmar).

### Armado de la vianda (✅ decidido: híbrido, definido por el plato)
Cada plato define su propio modo de armado — no es una regla global:
- **Prearmado**: el plato ya es una vianda completa definida por el admin como combo cerrado (guarnición y salsa fijas, con nombre propio de presentación — reutilizando el campo `nombre_vianda` existente). El cliente elige la vianda entera, no arma por partes.
- **Por partes**: el plato admite guarnición y/o salsa configurables. Extiende el patrón ya existente de `guarnicion_modo` (sin_guarnicion/fija/libre) agregando la misma lógica para salsa (`salsa_modo`: sin_salsa/fija/libre).

**✅ Aclaración cerrada (post-implementación Fase 1):** "Prearmado" no es un modo aparte ni necesita un campo propio — es simplemente el caso donde `guarnicion_modo='fija'` **y** `salsa_modo='fija'` a la vez (ej. "Fideos" con guarnición fija = Ensalada de lechuga y salsa fija = Bolognesa). El cliente no elige nada porque ambos componentes ya están resueltos por el plato. Casos intermedios (una fija + una libre, una fija + una sin, etc.) son combinaciones válidas de los mismos dos modos independientes. `nombre_vianda` sigue siendo el override manual opcional para cuando el nombre compuesto automático ("Fideos con ensalada de lechuga y salsa bolognesa") no alcanza (ej. querer mostrar "Fideos a la bolognesa").

### Reglas cerradas
- ✅ Guarnición y Salsa son **independientes entre sí**: cada plato define su propio `guarnicion_modo` (sin/fija/libre) y su propio `salsa_modo` (sin/fija/libre). Un plato puede tener ambas, una sola, o ninguna.
- 🟡 (default, sin objeción) La Vianda siempre requiere un Plato — no existe vianda sin plato.
- 🟡 (default, sin objeción) El catálogo de guarniciones/salsas es compartido entre platos, pero cada plato define su subconjunto permitido (patrón ya existente con `guarnicion_fija_id`, se extiende a `salsa_fija_id`).
- 🟡 (default, sin objeción) El viejo "canal" (vianda/local) se renombra a `modalidad_entrega` (envío/local/ambos) para liberar la palabra "vianda".

**Etapa 1: cerrada.**

---

## Etapa 2 — Menú (cómo se arma y cómo se ofrece)

### Decisión central (✅ decidido en sesión)
A las empresas **siempre se les ofrece Vianda, nunca Plato suelto**. El Plato es el componente base de catálogo/receta (uso interno); la Vianda es la unidad comercial que el cliente ve y pide. La composición exacta de cada vianda (solo plato / plato+salsa fija / plato+salsa a elección / plato+guarnición a elección+salsa a elección) la determina la configuración del plato que hay detrás (`guarnicion_modo` + `salsa_modo`, Etapa 1) — varía **por plato**, no por empresa ni por plan.

Consecuencia directa: el menú semanal y todo lo que vea el cliente debe hablar en términos de "viandas del día", no de "platos del día". El plato queda como concepto interno de catálogo/admin.

### Reglas cerradas
- ✅ Estructura del menú semanal por día **se mantiene igual** que hoy (fijo + especiales, N opciones por día), solo que cada opción es una vianda completa en vez de un plato suelto. No cambia la cantidad ni la lógica de slots.
- ✅ "Cómo van a salir" se refería a la **presentación al cliente en el menú** (nombre, foto, descripción de la vianda) — es parte de esta etapa. El empaquetado físico para cocina/reparto se deja para una etapa futura de Cocina/Logística, no se mezcla acá.
- 🟡 (default, sin objeción) Visibilidad por empresa se mantiene igual (`menu_empresa_visibilidad`) pero aplicada a viandas en vez de platos sueltos.

**Etapa 2: cerrada.**

## Etapa 3 — Planes comerciales y Empresas

### Decisión central (✅ decidido en sesión)
Postre y bebida **quedan fuera de la Vianda**. La Vianda sigue acotada a Plato + Guarnición (opcional) + Salsa (opcional) — sin cambios respecto a Etapa 1. Postre/bebida son un agregado del **plan comercial** que contrató la empresa (hoy `planes_vianda`: gramaje, incluye_postre, incluye_bebida), por fuera del concepto Vianda.

### Colisión de nombres detectada (🟡 pendiente de confirmar nombre)
La tabla actual `planes_vianda` usa la palabra "vianda" para el plan comercial, no para la composición. Con la redefinición de Etapa 1, esto colisiona. Propuesta: renombrar a `planes_servicio` o `planes_comerciales` (pendiente de que el usuario elija el nombre definitivo).

**Etapa 3: cerrada en su decisión central. Nombre de tabla pendiente.**

## Etapa 4 — Clientes

### Decisión (✅ decidido en sesión)
**Sin cambios.** Cliente final = empleado que pertenece a una empresa, sigue exactamente como hoy (tabla `empleados`, un pedido por semana, `UNIQUE(empleado_id, semana_inicio)`). No hay nada que redefinir en esta etapa.

**Etapa 4: cerrada, sin cambios respecto al sistema actual.**

---

## Etapa 5 — Pedidos

### Decisión central (✅ decidido en sesión)
El empleado **elige una Vianda por día**, no piezas sueltas. Ve las viandas ofrecidas ese día (ya armadas según el modo del plato detrás — prearmado o por partes) y elige una entera. Si el plato detrás de esa vianda permite guarnición y/o salsa "a elección" (`guarnicion_modo=libre` / `salsa_modo=libre`), el empleado ajusta esa parte dentro de la vianda elegida — no arma desde cero combinando piezas independientes.

**Consecuencia en el pedido**: cada `pedido_item` (por día) pasa a resolver una Vianda completa: referencia al plato + guarnición resuelta (fija o elegida) + salsa resuelta (fija o elegida), en vez de solo `plato_id` + `guarnicion_id` como hoy. Falta definir en la etapa de implementación si esto se guarda como `vianda_id` (si hay catálogo de viandas prearmadas) o como `plato_id + guarnicion_id + salsa_id` resueltos en el momento (si es armado libre) — probablemente ambos casos convivan según el modo del plato.

**Etapa 5: cerrada en su decisión central. Detalle de guardado (vianda_id vs campos resueltos) pendiente para la etapa de implementación/schema.**

---

## Resumen del modelo completo (post 5 etapas)

- **Plato**: unidad base de catálogo/receta (nombre, descripción, alérgenos, foto, etc. — sin cambios de fondo). Nunca se ofrece "pelado" a un cliente.
- **Guarnición** y **Salsa**: dos entidades separadas e independientes entre sí. Cada plato define su propio `guarnicion_modo` y `salsa_modo` (sin/fija/libre), y puede tener ambas, una sola, o ninguna a la vez.
- **Vianda**: Plato + Guarnición (opcional) + Salsa (opcional). Es la unidad comercial que siempre se ofrece a las empresas — nunca el plato suelto. Cada plato define si su vianda es "prearmada" (combo cerrado, con nombre propio reutilizando `nombre_vianda`) o "por partes" (el empleado ajusta lo que esté en modo libre).
- **Postre / bebida**: quedan fuera de la Vianda. Son un agregado del **plan comercial** de la empresa (hoy `planes_vianda` — a renombrar, ver Etapa 3).
- **Menú semanal**: mantiene la estructura actual (fijo + especiales, N opciones por día, visibilidad por empresa), pero cada opción del día es una Vianda completa, no un plato suelto.
- **Empresa**: sin cambios de fondo — sigue siendo la que contrata un plan comercial (gramaje + postre + bebida) y ve el menú de viandas habilitado para ella.
- **Cliente final (empleado)**: sin cambios.
- **Pedido**: el empleado elige una Vianda por día (no arma piezas sueltas); si esa vianda tiene partes "a elección", las ajusta dentro de la elección de vianda.

## Renombres y ajustes de nombres (✅ decidido en sesión)

### `platos.canal` — hallazgo importante
El local **no vende viandas** — vende platos por kilo (mostrador/retail), un negocio distinto del circuito B2B de catering (vianda) que gestiona este sistema. Es decir, el viejo `canal` (vianda/local/ambos) en realidad distinguía dos negocios distintos, no dos formas de entrega de lo mismo.

✅ Se confirmó que **la venta por kilo en sí (precio, cobro, pedidos) queda fuera de alcance de este sistema**. Pero **no es un dato puramente decorativo**: el Local sí necesita modelarse con un mínimo de calendario, porque alimenta la Vista Cocina (ver "Etapa 6" más abajo). ⚠️ Esto revisa una decisión anterior: ya no alcanza con un boolean simple `tambien_en_local` — hace falta un calendario de disponibilidad (ver más abajo).

### `planes_vianda`
✅ Se renombra a **`planes_comerciales`**.

**Etapa 1: cerrada (revisada por hallazgo de Local — ver Etapa 6).**

---

## Etapa 6 — Local y Cocina centralizada

### Contexto
El objetivo de fondo no es vender por kilo desde este sistema, sino que **Cocina tenga la info centralizada de qué preparar cada día**, tanto para viandas (pedidos reales de empresas) como para el local (venta por kilo, gestionada fuera del sistema pero programada acá).

### Calendario de disponibilidad en el Local (✅ decidido en sesión)
Reemplaza el boolean simple `tambien_en_local` de Etapa 1. Un plato puede estar disponible en el local según tres patrones, no excluyentes entre sí:
- **Diario**: disponible todos los días.
- **Día(s) de semana fijo(s)**: recurrente en uno o más días de la semana (ej. "todos los miércoles hay pastel de papa"). ✅ Un plato puede tener **más de un día fijo** (ej. lunes y miércoles) — no se limita a un solo día como el `dia_fijo` actual de vianda.
- **Fecha puntual**: disponible una única fecha específica, sin recurrencia (ej. "este sábado 12/07 hay matambre a la pizza", sin que se repita todos los sábados).

Modelo propuesto (🟡 a validar en etapa de implementación): tabla `plato_disponibilidad_local` con filas por plato — cada fila define un patrón (diario / día de semana / fecha puntual), permitiendo múltiples filas por plato para cubrir combinaciones (ej. varios días fijos).

### Promoción de un especial de Local a Vianda (✅ decidido en sesión)
Un plato programado en el local (fijo por día de semana o puntual) puede **promoverse a vianda para una semana específica**, dentro del **mismo flujo de diseño de menú semanal que ya existe** — no se crea un flujo aparte. El diseñador de menú semanal va a mostrar como candidatos fáciles de agregar los platos que ya están programados esa semana en el calendario del Local (fijos y puntuales), evitando tener que cargarlos de nuevo.

Al promoverlo, se configura para esa publicación puntual (extiende el patrón de override que ya existe hoy a nivel de `menu_semanal_dias`):
- `guarnicion_modo` para esa instancia (sin/fija/libre).
- `salsa_modo` para esa instancia (sin/fija/libre) — nuevo, análogo al de guarnición.
- Si se publica o no esa semana como vianda (flag on/off).

### Nombre de presentación (✅ decidido en sesión)
- **En el Local**: se muestra el nombre del Plato tal cual (ej. "Fideos").
- **En Vianda**: el nombre/descripción visible se **compone dinámicamente** a partir del plato + los componentes activos de esa publicación (ej. "Fideos + salsa a elección + guarnición a elección", o "Fideos" a secas si no lleva nada más). El campo `nombre_vianda` existente deja de ser el nombre principal automático y pasa a ser un **override manual opcional**, solo para casos de combo con nombre comercial propio (ej. "Combo Criollo") que no se quiera describir por composición.

### Vista Cocina — ampliación (✅ decidido en sesión)
La Vista Cocina (hoy `CockpitCocina.jsx`, solo pedidos de vianda) se amplía para centralizar, por día:
1. **Pedidos de vianda confirmados**, con conteos reales por empresa (como hoy).
2. **Checklist de platos programados para el Local ese día** (derivado del calendario de disponibilidad local: diario + día de semana que matchea + fecha puntual de hoy), **sin cantidad** — solo qué platos hay que tener listos, la cantidad la maneja cocina a criterio propio.

**Etapa 6: cerrada en sus decisiones centrales.**

### Días fijos: vianda vs local (✅ decidido en sesión)
En **Vianda**, "fijo" significa disponible **todos los días de la semana, siempre** — no admite días específicos, se mantiene como hoy (sin cambios en `dia_fijo`/`disponibilidad` de vianda). El matiz de "fijo en día(s) específico(s) de la semana" es exclusivo del calendario del **Local** (`plato_disponibilidad_local`, Etapa 6). Son dos conceptos de "fijo" distintos y no se unifican.

## Pendiente de repasar antes de dar por cerrado el modelo
- Validar en implementación la estructura exacta de `plato_disponibilidad_local` (una tabla de patrones vs. columnas en `platos`).

## Próximo paso sugerido
Con el modelo conceptual cerrado en las 5 etapas, el siguiente paso natural es traducirlo a un plan de implementación concreto: qué migraciones nuevas se necesitan (tabla `salsas`, columnas `salsa_modo`/`salsa_fija_id` en `platos`, renombres), qué módulos/endpoints cambian (`platos`, `menus-semanales`, `pedidos`), y en qué orden — sin tocar el código todavía hasta que el usuario confirme que quiere pasar a esa fase.

## Implementación — Fase 1 (✅ hecha, 2026-07-10)

Implementada y verificada (69/69 tests de la suite API en verde, lint limpio):
- Migraciones `1719000058000` a `1719000061000`: tabla `salsas`, `platos.salsa_modo`/`salsa_fija_id`, `pedido_items.salsa_id`, `menu_semanal_dias.salsa_modo_override`/`salsa_fija_override_id`.
- Módulo nuevo `API_LA_QUINTA/src/modules/salsas/` (clon de `guarniciones`, sin columna `tipo`), montado en `/api/v1/salsas`.
- `platos`, `pedidos` (validation/service/repository) y `menus-semanales` (schema/service/repository/controller/routes) extendidos con salsa en paralelo a guarnición — modos independientes (`sin_salsa`/`fija`/`libre`), nueva ruta `PATCH /:id/dias/:dia/:opcion/salsa`.
- `construirTextoItem` en `pedidos.service.js` ya compone el nombre dinámico de la vianda (plato + guarnición + salsa según corresponda), primer paso hacia la decisión de Etapa 6 sobre nombre de presentación.

## Implementación — Fase 2 (✅ hecha, 2026-07-10)

Rename `planes_vianda` → `planes_comerciales` completo y verificado (75/75 tests API en verde, lint limpio):
- Migración `1719000062000_planes-comerciales-rename.js`: rename de tabla, secuencia, PK, UNIQUE(codigo) y CHECK(gramaje).
- Código actualizado: `planes.repository.js` (6 queries), `empresas.repository.js`, `cocina.repository.js`, `auth.service.js` (JOINs a la tabla renombrada). Las migraciones históricas (`1719000043000`, `1719000056000`) no se tocaron — son inmutables.
- Test de integración nuevo `test/planes.http-db.test.js` (CRUD completo + soft delete).
- Hallazgo colateral (no corregido, fuera de alcance de esta fase): `planes.controller.js::normalizarPlan` falla con 400 al crear un plan sin `gramaje_max` (calcula `Number(undefined)` en vez de tratarlo como ausente). Ver nota en `docs/ai/20-modules.yaml`.

## Implementación — Fase 3 (✅ hecha, 2026-07-10)

Eliminación de `canal` + calendario de disponibilidad del Local, completa y verificada (82/82 tests API en verde, lint limpio):
- Migraciones `1719000063000` a `1719000066000`: `platos.disponible_vianda` (bool, backfill desde `canal <> 'local'`), tabla `plato_disponibilidad_local` (patrón `diario`/`dia_semana`/`fecha`, con CHECK de campos coherentes por patrón), drop de `menu_semanal_dias.canal`, drop de `platos.canal` + tipo `plato_canal`.
- `platos`: `disponible_vianda` reemplaza `canal` en schema/repository/service/controller. Nuevo sub-recurso `GET/PUT /api/v1/platos/:id/disponibilidad-local` (mismo patrón que `visibilidad-empresas`: reemplaza toda la lista). Repository incluye `findParaFecha(fecha)` (diario + día de semana que matchea + fecha puntual) ya listo para que lo consuma Cocina en Fase 4.
- `menus-semanales`: `agregarPlatoDia` rechaza (409) un plato con `disponible_vianda=false`. `canal` eliminado de schema/repository/service. Los candidatos "fijo"/"siempre" para el diseño de menú ahora filtran `disponible_vianda=true`.
- `pedidos`: `validateItemForMenu`/`guardarPedido` rechazan (422) un plato con `disponible_vianda=false` aunque siga `activo=true` (cubre el caso de que se desactive para vianda después de estar ya en un menú publicado). `cargarPlatosFijos` filtra `disponible_vianda=true`.
- `cocina.repository.js`: `canal` eliminado de selects/group by/order by; `findFijosYSiempre` filtra `disponible_vianda=true`.
- `scripts/seed-test-data.js`: limpiado (ya no seleccionaba `canal` para nada downstream); también se corrigió una referencia residual a `planes_vianda` (bug de la Fase 2 que no vivía bajo `src/`, no se había detectado).
- Tests nuevos: `test/platos-disponibilidad-local.http-db.test.js` (calendario + rechazo de plato no disponible en diseño de menú) y casos nuevos en `pedidos.http-db.test.js` (plato con `disponible_vianda=false` rechazado en `POST /pedidos` y ausente en `GET /pedidos/semanas`).

**Gap conocido, no corregido (fuera de alcance):** el pipeline alternativo `npm run seed:catalogo-menus` (`build-dataset.mjs` + `seed-catalogo-menus.js` + `data/out/platos.json`/`data/fijos.json`) sigue usando `canal` y quedaría roto si se ejecuta — no es el pipeline documentado en `CLAUDE.md` (`npm run seed` usa `seed:catalogo` + `seed:menus`, que no tocan `canal`). Requiere entender la fuente de datos cruda que consume `build-dataset.mjs` antes de migrarlo; no se tocó para no arriesgar una migración a ciegas.

## Implementación — Fase 4 (✅ hecha, 2026-07-10)

Cocina centralizada, completa y verificada (83/83 tests API en verde, lint limpio):
- `cocina.repository.js`: `SLOTS_SELECT` y `findDetalleEtiquetas` (etiquetas para imprimir) ahora incluyen `salsa_modo`/`salsa_modo_override`/`salsa_nombre` en paralelo a guarnición.
- `cocina.service.js`: `getCocinaHoy` y `getCocinaSemana` devuelven `checklist_local` — platos programados en el Local para esa fecha (diario / día de semana que matchea / fecha puntual), obtenidos reutilizando `platosRepository.findParaFecha` (ya escrito en la Fase 3, sin duplicar SQL). Sin cantidades: el Local no genera pedidos ni ventas en este sistema, es solo informativo para que Cocina sepa qué tener preparado. `conteos_vianda` (pedidos reales) queda intacto y ahora arrastra salsa a través de las queries actualizadas.
- No hizo falta ninguna ruta nueva: se anidó en las respuestas existentes de `GET /cocina/hoy` y `GET /cocina/semana/:menuId` para no romper el frontend actual antes de tiempo (Fase 5 lo consume).
- Test nuevo `test/cocina.http-db.test.js`: arma un pedido de vianda (plato+guarnición+salsa) para "hoy" y un plato con disponibilidad de Local ese mismo día de semana; verifica que `GET /cocina/hoy` devuelve ambos — el conteo de vianda con su empresa, y el plato del Local en el checklist sin ningún campo de cantidad.
- El módulo `cocina` no tenía entrada en `docs/ai/20-modules.yaml` — se agregó de paso (estaba completamente indocumentado).

## Implementación — Fase 5 (✅ hecha, 2026-07-10)

Frontend (admin + cliente), correctitud funcional verificada manualmente en navegador con datos reales (sin pulido visual, a revisar en una pasada de UX/UI dedicada aparte):

- **`front_menu`**: módulo nuevo `Salsas` (hook/página/panel/nav, clon de Guarniciones sin `tipo`) — CRUD verificado end-to-end. `PlatoForm` reemplaza el bloque "Canal" por el toggle "Disponible para vianda (empresas)" y agrega el bloque "Salsa" (mismas 4 opciones que Guarnición). `Platos.jsx` reemplaza el filtro de Canal por "Disponible en vianda: Todos/Sí/No" y agrega `DisponibilidadLocal` (checklist diario/día de semana/fecha puntual) dentro de `DetallePlatoModal` — verificado con PUT/GET reales contra `/platos/:id/disponibilidad-local`. `DisenoMenu.jsx` eliminó por completo la noción de "Local" (ya no hay slots de local que diseñar, todo es vianda); el picker combinado "Guarnición y salsa" y el buscador de platos (con badges "Guarnición fija"/"Salsa fija") funcionan correctamente. `CockpitCocina.jsx` muestra la sección "Local hoy" con el checklist (sin cantidades) cuando hay platos programados para ese día — verificado contra datos reales de `plato_disponibilidad_local`.
- **`front_clientes`**: `WeeklyOrderView.jsx` (único componente vivo del flujo de pedido) permite elegir guarnición y salsa para un plato con ambos modos "a elección"; el resumen del día muestra "Plato · Guarnición · Salsa". Confirmado un pedido semanal real de punta a punta (login empleado → elegir plato+guarnición+salsa → confirmar) y verificado en `pedido_items` que `plato_id`, `guarnicion_id` y `salsa_id` persistieron correctamente juntos.
- **Bug encontrado y corregido durante la verificación**: al reescribir `renderFilas` en `Platos.jsx` para quitar el badge de Canal, se perdió el `onClick` de la fila (`<tr>`) que abría `DetallePlatoModal` — dejaba el nuevo componente `DisponibilidadLocal` inalcanzable desde la UI (solo el botón "Editar" seguía funcionando, y abría el formulario de edición, no el detalle). Corregido restaurando el `onClick={() => setDetalle(plato)}` en la fila y agregando `stopPropagation` al botón "Editar" para que no dispare ambos modales a la vez.
- **Hallazgo de datos, no corregido (fuera de alcance)**: la tabla `guarniciones` conserva 6 filas históricas con nombre "Salsa ..." (Salsa blanca/bolognesa/caruso/con albóndigas/de hongos/fileto) — residuo de antes de que Salsa se separara como entidad independiente en la Fase 1, cuando las salsas se modelaban como guarniciones. Aparecen mezcladas alfabéticamente en el selector de Guarnición de `front_clientes`/`front_menu` junto a guarniciones reales. No es un bug de código de esta fase — es limpieza de datos pendiente que requiere una decisión del usuario (¿desactivar? ¿renombrar? ¿fusionar con la tabla `salsas`?).
- Validación: `front_menu` (`npm run lint` 0 errores/2 warnings preexistentes en `Semanas.jsx`, `npm run build` OK), `front_clientes` (`npm run lint`, `npm run build`, `npm test` 14/14, `npm run test:e2e` 1/1, todos en verde).

**Las 5 fases del replanteo de dominio están completas.** Próximo paso (explícitamente señalado por el usuario para después, no iniciado): una revisión dedicada de UX/UI sobre todo el sistema.
