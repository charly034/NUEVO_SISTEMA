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
- Hallazgo colateral (RESUELTO 2026-07-17): `planes.controller.js::normalizarPlan` ya trata `gramaje_max` ausente (`undefined`/`''`/`null`) como `null` en vez de hacer `Number(undefined)`; crear un plan sin `gramaje_max` lo persiste como `null`. Cubierto por `test/planes.http-db.test.js` ("POST /api/v1/planes sin gramaje_max lo persiste como null").

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

---

# Replanteo v2 — Menú base vs Menú compuesto (idea nueva 2026-07-18, EN DISCUSIÓN)

> **Estado: DRAFT, en discusión. No implementado.** Evolución mayor propuesta por el usuario que **supersede partes del modelo de Vianda (Etapas 1-5, ya implementadas)**: reifica la combinación como entidad de catálogo **con nombre**, la **generaliza a N platos base**, y mueve la resolución de guarnición/salsa del momento del pedido al catálogo. Cambia cómo se guardan platos/menús y toca pedidos/cocina/UI.

## Origen / motivación
Coincide 1:1 con la estructura del **Google Form real de pedido semanal** (FORMULARIO EDISON, analizado 2026-07-18): cada opción del dropdown "Principal" ES un "menú compuesto" ("Arroz con pollo" = 1 base sin guarnición; "Milanesa de pollo + guarnición" = 1 base + guarnición a elección; "Suprema caprese con puré de papas" = 1 base + guarnición fija; "budín bicolor con bomba de papa" = 2 bases). Formaliza cómo ya se opera.

## Conceptos
- **Menú base** (átomo): el plato individual (fideos, milanesa, budín bicolor, bomba de papa). Es el `platos` actual, pero **pierde `guarnicion_modo`/`salsa_modo`/`*_fija_id`** (migran al compuesto).
- **Guarnición / Salsa**: catálogos aparte (sin cambio respecto a hoy).
- **Menú compuesto** (entidad NUEVA, catálogo reusable con nombre auto): una **bolsa de componentes**, cada uno con **rol** (`principal` / `guarnición` / `salsa`) y **modo** (`fijo` = ref específica / `a elección` = el cliente/empresa elige). (Modelo genérico de componentes con rol, NO slots rígidos — decisión del usuario 2da ronda.)
  - **1..N componentes `principal`** (siempre fijos, cada uno ref a un plato base) — habilita el combo multi-plato ("budín bicolor + bomba de papa"), hoy imposible.
  - **0..1 componente `guarnición`** — fijo (una guarnición) o a elección (cualquiera de las activas; se hacen las 14 igual, no hace falta acotar el set).
  - **0..1 componente `salsa`** — fijo o a elección. **Salsa es componente de PRIMERA CLASE** (supersede el parche "salsa en el nombre" del modelo viejo/seed).

## Decisiones cerradas (2026-07-18)
- ✅ **Fijas y a-elección conviven** (como el form: "Suprema con puré" fija vs "Milanesa + guarnición" a elección). Evita la explosión combinatoria: una guarnición que varía es UN compuesto "a elección", no uno por guarnición.
- ✅ **En el armado semanal SIEMPRE se elige un compuesto.** Un plato "pelado" = compuesto de 1 base sin guarnición ni salsa. Un solo concepto en la grilla semanal (no hay "plato suelto" vs "compuesto").
- ✅ **Override de composición POR EMPRESA** (no es visibilidad): el mismo compuesto "Milanesa con puré" (guarnición fija=puré por default) puede resolverse como **guarnición a elección** para las empresas que lo piden. Es un override de MODO (y del valor fijo) por (compuesto, empresa), **standing**: aplica cada vez que ese compuesto se ofrece a esa empresa, no por semana.

## Modelo de tablas (🟡 propuesta, a validar en implementación)
- `platos` (menú base): `nombre` + metadata (kcal, alérgenos, foto, descripción). Se le **quitan** `guarnicion_modo/salsa_modo/guarnicion_fija_id/salsa_fija_id` (migran al compuesto).
- `menu_compuesto`: `id, nombre_override (nullable), foto_override (nullable), activo`. Los modos/refs de guarnición/salsa ya NO son columnas: son componentes (ver abajo). **El nombre NO se tipea en el caso común: se AUTO-COMPONE** de los componentes resueltos (principal(es) + guarnición/salsa fija, con marca "a elección" cuando aplica), reutilizando la lógica de `construirTextoItem` (pedidos.service.js). `nombre_override` = el actual `nombre_vianda`, solo para nombres comerciales propios ("Combo Criollo") o redacción custom ("Fideos a la bolognesa"). Como el nombre se compone del resultado RESUELTO, respeta automáticamente el override por empresa sin duplicar registros.
- `menu_compuesto_componente`: `(menu_compuesto_id, rol ∈ principal|guarnicion|salsa, modo ∈ fijo|libre, ref_id nullable [plato_id/guarnicion_id/salsa_id según rol; NULL si modo=libre], orden)`. Reemplaza a `menu_compuesto_plato` + las columnas de modo del compuesto. Principales: `rol=principal, modo=fijo`, 1..N refs a plato. Guarnición/salsa: 0..1 componente cada uno, `fijo` (con ref) o `libre` (sin ref).
- `menu_compuesto_empresa_override`: `(menu_compuesto_id, empresa_id, guarnicion_modo?, guarnicion_fija_id?, salsa_modo?, salsa_fija_id?)` — override de composición por empresa (decisión 3, standing).
- `menu_semanal_dias`: pasa a referenciar **`menu_compuesto_id`** (en vez de `plato_id` + `vianda_id` + overrides de slot). Conserva `dia, opcion, categoria_id`.
- `pedido_items`: referencia `menu_compuesto_id` + la guarnición/salsa **resuelta elegida** (cuando el modo es a elección) + snapshot para cocina/histórico.

## Qué supersede del modelo actual (⚠️ blast radius grande)
- La tabla `viandas` (Plato+Guarnición?+Salsa? por empresa, Fase 1/5) queda **subsumida** por `menu_compuesto` (su versión con nombre + multi-base). Migración: cada vianda/plato-con-modo actual → un compuesto de 1 base.
- Los modos guarnición/salsa **dejan `platos`** y viven en `menu_compuesto`.
- `menu_semanal_dia_empresa_override` (override por celda/semana, mig. 1719000080000) se **reemplaza** por `menu_compuesto_empresa_override` (override por compuesto, standing) — o conviven si se quiere además override puntual por semana.
- Toca: `menus-semanales`, `pedidos` (item pasa a compuesto+resueltos), `cocina` (etiquetas/conteos), front admin (armado en `MenuResumen.jsx`) y front cliente (elección en `WeeklyOrderView.jsx`).

## Principio anti-explosión de registros (✅ 2026-07-18, preocupación central del usuario)
El catálogo de compuestos NO debe multiplicarse como platos × guarniciones. Dos palancas lo evitan:
- ✅ **"A elección" colapsa las combinaciones**: NO se crea un compuesto por guarnición. Se crea UNO "Milanesa (guarnición a elección)" que cubre todas; la guarnición la resuelve el cliente/empresa. Compuestos **fijos** solo para combos curados obligatorios ("Suprema con puré", "budín bicolor + bomba de papa").
- ✅ **El override por empresa evita duplicar por empresa** (no se crea un compuesto por empresa; se pone un override sobre el mismo compuesto).
- **Regla mental**: nº de compuestos ≈ nº de platos base + un puñado de combos curados (NO platos × guarniciones). Ej: ~30 bases → ~40 compuestos, no ~420. El compuesto es una capa FINA para el caso común y solo "engorda" en los combos fijos y multi-plato.

## Definiciones cerradas de las preguntas (2026-07-18)
- ✅ **Metadata**: la cruda (kcal, alérgenos) vive en el **plato base**; el compuesto la **deriva/agrega** de sus base(s) + guarnición/salsa fijas (no la copia, evita duplicación). El compuesto tiene campos propios de **presentación** (nombre visible, foto) que pueden pisar los del base. Columnas en la misma entidad (`platos` / `menu_compuesto`), sin tabla de metadata aparte.
- ✅ **fijo-de-siempre vs especial es propiedad de la CELDA SEMANAL** (`categoria_id` en `menu_semanal_dias`), NO del compuesto. Confirmado con caso real: "Tarta de acelga" (compuesto sin guarnición) va como fijo casi siempre, y "Tarta de acelga + ensalada" (otro compuesto, guarnición fija) se pone como especial una semana puntual. Dos compuestos comparten el mismo base — uso correcto, no explosión.
- ✅ **Diseño óptimo sin compat legacy**: como no está en producción, se puede tirar `viandas` y los overrides viejos directamente y hacer la migración de datos limpia.
- ✅ **Override standing** (decidido 2026-07-18): el override de composición por empresa vive en el **compuesto** y es standing (`menu_compuesto_empresa_override`) — aplica siempre que ese compuesto se ofrece a esa empresa. NO se construye el override puntual-por-semana por ahora (se puede sumar después como capa que pisa al standing si aparece una necesidad real). **El modelo queda 100% cerrado.**

## Migración de datos (🟡, óptima sin legacy)
- Platos con `guarnicion_modo`/`salsa_modo` actuales → un compuesto de 1 base cada uno (el modo migra al compuesto).
- `viandas` ancladas → compuestos.
- `menu_semanal_dias` actuales → apuntar al compuesto correspondiente.
- Se pueden dropear `viandas` y `menu_semanal_dia_empresa_override` (reemplazado por override por empresa en el compuesto).

## Plan de migración por fases (🟡 propuesta, modelo cerrado 2026-07-18)
Al no estar en producción se puede migrar directo, pero se conserva un test de **paridad shadow-read** como gate de correctitud (igual que el teardown de categorías, que resultó seguro). Orden:

- **Fase 0 — Schema aditivo (migración nueva).** Crear `menu_compuesto`, `menu_compuesto_plato`, `menu_compuesto_empresa_override`. Agregar `menu_compuesto_id` NULLABLE a `menu_semanal_dias` y `pedido_items`. No tocar nada viejo todavía. Cero cambio de comportamiento.
- **Fase 1 — Backfill del catálogo de compuestos.** Script: por cada `plato` actual con sus `guarnicion_modo/salsa_modo` → crear un compuesto de **1 base** con esos modos (nombre = nombre del plato). Los combos fijos y multi-base curados se cargan explícitos. **Este backfill se fusiona con el seed consolidado nuevo** (`seed:consolidado`) — el seed pasa a sembrar compuestos, no platos con modos.
- **Fase 2 — Backfill de menús + paridad.** Apuntar `menu_semanal_dias.menu_compuesto_id` al compuesto equivalente. Test de paridad: leer el menú por el path viejo (plato+modo+vianda) == leerlo por el compuesto, sobre TODOS los menús reales (patrón `categorias-fase-b-paridad`).
- **Fase 3 — Flip backend.** `menus-semanales`, `pedidos` y `cocina` leen del compuesto. `pedido_items` pasa a `menu_compuesto_id` + guarnición/salsa **resueltas** (cuando el modo es a elección) + snapshot.
- **Fase 4 — UI admin (`MenuResumen.jsx`).** CRUD del catálogo de compuestos; armado semanal eligiendo compuestos (1 concepto en la grilla); override por empresa (standing) en el compuesto. Reemplaza el drawer de celda actual (plato+guarnición/salsa+excepciones).
- **Fase 5 — UI cliente (`WeeklyOrderView.jsx`).** El cliente ve compuestos por día; si el compuesto (o su override de empresa) es "a elección", elige guarnición/salsa dentro.
- **Fase 6 — Limpieza (sin legacy).** Drop `viandas`, `menu_semanal_dia_empresa_override`; drop columnas `guarnicion_modo/salsa_modo/guarnicion_fija_id/salsa_fija_id` de `platos`; drop `plato_id/vianda_id` de `menu_semanal_dias`/`pedido_items` una vez migrado y verde.

**Áreas de alto riesgo del plan**: `pedidos` (el item cambia de forma), `cocina` (etiquetas/conteos leen del compuesto), y las dos UIs de armado/elección. Gate por fase: `npm test` (secuencial) verde + paridad en verde antes de cada flip.

## Refinamientos 2da ronda (✅ 2026-07-18) — modelo definitivo
Tras una crítica al modelo, el usuario resolvió:
- ✅ **Rewrite completo confirmado**, motivado por un dolor real y recurrente: hoy poner un plato en el menú exige que tenga una **vianda asociada** ("no hay vianda asociada" → doble trabajo). Con el compuesto se compone directo, sin pre-asociar nada.
- ✅ **Modelo genérico de componentes con rol** (no slots rígidos base[N]+guarnición[1]+salsa[1]). Tabla `menu_compuesto_componente` (rol + modo + ref).
- ✅ **Salsa = componente de primera clase.** ⚠️ Esto **supersede** el seed `seed:consolidado` que se armó el 2026-07-18 (que dejaba la salsa dentro del nombre del plato y la tabla `salsas` vacía): la migración debe **poblar `salsas` de verdad** y **separar las salsas de los nombres** de plato. La descomposición de `src/database/seeds/data/decomposicion.json` (que ya separa "Salsa fileto" etc.) es la fuente para esto.
- ✅ **fijo/especial se mantiene en la CELDA semanal** (revierte la contra-propuesta de la crítica): permite sacar un fijo una semana puntual sin tocar el catálogo. Se agrega un **auto-fill de conveniencia** (precargar los fijos habituales al crear cada semana) para no re-cargarlos a mano, pero la celda es la autoridad y es editable por semana.
- ✅ **"A elección" = todas las guarniciones activas** (no hace falta whitelist por semana: la cocina prepara las 14 igual). Mantiene el modelo simple.
- ✅ **Auto-crear el compuesto default al crear un plato base** ("Milanesa" → auto "Milanesa (guarnición a elección)"): elimina la fricción de la relación 1:1 base↔compuesto en el caso común; el base queda disponible para reutilizarse en combos/especiales.
- ✅ **Metadata**: cruda en el base, derivada al compuesto (sin duplicar); presentación (nombre/foto) override opcional en el compuesto.
- **Override por empresa**: standing en el compuesto (`menu_compuesto_empresa_override`), pisa el modo/ref de los componentes guarnición/salsa para esa empresa.

## Diseño operativo (cómo opera end-to-end, 2026-07-18)
- **Admin · Catálogo**: crea un plato base (nombre+metadata) → se **auto-crea su compuesto default** "X (guarnición a elección)", listo para usar sin pre-asociar viandas. Crea compuestos curados (fijo, combo multi-plato, con salsa fija) con un editor de componentes (principal/guarnición/salsa, cada uno fijo o a elección); nombre auto + override. Cataloga guarniciones y salsas (reales).
- **Admin · Armado semanal** (corazón): abre la semana → grilla precargada con los fijos habituales (auto-fill), editable. Por día agrega compuestos buscándolos por nombre (un solo concepto); marca cada celda fijo/especial; puede sacar un fijo puntual sin tocar el catálogo; setea override por empresa en el compuesto (standing).
- **Cliente · Pedido**: ve los compuestos del día para su empresa (con overrides aplicados, nombre auto, foto, metadata derivada); elige uno por día; si tiene guarnición/salsa a elección, elige adentro; confirma. `pedido_item` guarda compuesto + resueltos.
- **Cocina**: conteos agregados por compuesto y por componente + etiquetas.

## Roadmap de implementación con skills (2026-07-18)
**Diseño (pre-código):** 1) `/spec` (spec ejecutable: tablas/migraciones/contratos/tests/6 fases) → 2) `/plan-eng-review` (arquitectura + riesgo de migración) → 3) `/design-consultation` (UI armado semanal + editor compuesto + picker cliente) → 4) `/plan-design-review` → (atajo) `/autoplan` corre CEO+design+eng+DX de una. Más el mockup.
**Build (las 6 fases):** cada fase: implementar → `/review` (diff) → `/verify` (end-to-end) → `npm test` secuencial. `/design-review` sobre las UIs. `/ship` al cerrar.

## Próximo paso sugerido
Traducir a un **plan de migración por fases** (tablas nuevas → backfill de compuestos desde platos/viandas actuales → flip de `menu_semanal_dias` y `pedidos` → UI admin/cliente → limpieza de columnas viejas), con paridad shadow-read como en el teardown de categorías. No tocar código hasta cerrar el modelo y las preguntas abiertas.

---

# Replanteo v3 — Semana como raíz (idea nueva 2026-07-18, EN DISCUSIÓN)

> **Estado: DRAFT, en discusión. No implementado.** Reencuadre estructural propuesto por el usuario que **sube un nivel por encima de v2**: la **semana** deja de ser una fecha suelta y pasa a ser la **entidad raíz (aggregate root)** que contiene menús, pedidos, especiales, producción de cocina y disponibilidad del local. NO reemplaza al compuesto v2 — lo **re-enraíza** debajo de la semana. Ambos rediseños se fusionan en un solo modelo objetivo, un solo `/plan-eng-review` y un solo plan de migración (tocan las mismas tablas: `menus_semanales`, `menu_semanal_dias`, `pedidos`).

## Origen / motivación
El usuario arrancó el diseño menú-primero (v1/v2) y después se dio cuenta de que **lo que une todo es la semana**: cada semana tiene menús, pedidos, especiales y la producción de cocina. Los diseños viejos (menú como cuasi-raíz) son residuo de ese arranque invertido.

## Diagnóstico del estado actual (verificado en migraciones, 2026-07-18)
- **`menus_semanales` NO es "la semana": es un menú** con `id, nombre, fecha_inicio, fecha_fin, estado (borrador/publicado/cerrado)`. No tiene `empresa_id` ni `categoria_id`. La rotación (ciclos) vive **DENTRO** de un menú (`categoria_grupo` + `grupo_rotativo_seleccion_semana` + `categoria_grupo_seleccion_semana`, todas keyed por `menu_semanal_id`).
- **La semana hoy = una fecha desparramada, sin entidad.** Aparece como `date` en ≥5 lugares atados solo por coincidencia de fecha: `menus_semanales.fecha_inicio`, `pedidos.semana_inicio`, `pedido_sugerencias.semana_inicio`, `sugerencias_empleados.semana_inicio`, `pedido_sugerencia_opciones.semana_inicio`.
- **`pedidos`** tiene `menu_semanal_id` (FK blanda, ON DELETE SET NULL) **y** `semana_inicio date NOT NULL`; el invariante "un pedido por semana" es `UNIQUE(empleado_id, semana_inicio)` (la **fecha**, no el menú). El puente pedido↔menú es la igualdad de fechas (`pedidos.service.js` valida `menu.fecha_inicio == semana_inicio`), no una FK dura.
- **Cocina** agrega la producción por `p.semana_inicio` (fecha), no por `menu_semanal_id` (`cocina.repository.js` `findConteosPedidos`/`findKPIsHoy`/`findTotalesPorDia`). Los slots del menú se leen aparte por `menu_semanal_id`. El puente menú↔pedidos es la fecha.

## Decisión central (✅ decidido en sesión 2026-07-18)
- ✅ **`semanas` = entidad nueva, aggregate root.** Identidad = `fecha_inicio` (el lunes), **UNIQUE** (una fila por semana calendario). `fecha_fin` derivable.
- ✅ **`semana` 1—N `menus_semanales`** (el usuario eligió "varios menús por semana", una **capacidad nueva** — hoy es efectivamente 1 menú por semana). Ver ❓ de ruteo empresa→menú más abajo, que esta decisión abre.
- ✅ **Todo lo que hoy se ata por `semana_inicio`/`fecha_inicio` (date) pasa a FK `semana_id`.**

## Modelo objetivo (semana como raíz)
```
semanas  (NUEVA — PK propia; fecha_inicio UNIQUE = el lunes; fecha_fin)
├── menus_semanales        → +semana_id FK  (1—N: varios menús por semana)
│    └── menu_semanal_dias  → (bajo compuesto v2: menu_compuesto_id; celda = fijo/especial por categoria_id)
├── pedidos                → +semana_id FK; UNIQUE(empleado_id, semana_id) reemplaza (empleado_id, semana_inicio)
│                            conserva menu_semanal_id = de qué menú de la semana pidió
├── pedido_sugerencias / sugerencias_empleados / pedido_sugerencia_opciones → +semana_id FK
├── plan de local/buffet   → materialización por semana (ver ❓)
└── producción de cocina   → DERIVADA: agregado de pedidos.semana_id + buffet de esa semana
```

## Reconciliación con el compuesto v2 (⚠️ un solo modelo)
Las decisiones de v2 se **mantienen intactas**, solo cambia su raíz:
- `menu_compuesto` / `menu_compuesto_componente` / `menu_compuesto_empresa_override` → sin cambios; `menu_semanal_dias.menu_compuesto_id` sigue igual.
- fijo/especial en la celda (`categoria_id`), auto-crear compuesto al crear plato, salsa de primera clase, override standing por empresa → sin cambios.
- Lo único que cambia: `menus_semanales` ahora cuelga de `semanas` (FK `semana_id`) en vez de identificarse por `fecha_inicio`.
- **Consecuencia operativa**: se hace **una** migración grande (semana-raíz + compuesto), no dos seguidas sobre las mismas tablas.

## Mapeo viejo→nuevo (los "diseños viejos que quedan")
| Viejo (residuo del arranque menú-primero) | Problema | Nuevo (semana-raíz) |
|---|---|---|
| Semana como `date` suelta en ≥5 tablas | Sin entidad; unido por coincidencia de fecha | Entidad `semanas` + FK `semana_id` en todas |
| `menus_semanales` cuasi-raíz por `fecha_inicio` | Es un menú, no la semana | Cuelga de `semanas` vía `semana_id` |
| `pedidos` UNIQUE(empleado_id, `semana_inicio`) | Invariante sobre una fecha | UNIQUE(empleado_id, `semana_id`) |
| Cocina agrega por `p.semana_inicio` | Producción unida por fecha | Agrega por `p.semana_id` (misma semana-entidad) |
| `platos.disponibilidad`/`dia_fijo` | Mezcla "fijos del menú" (canal vianda) con "buffet" | La parte fijos-de-menú es de la celda/semana; la de buffet va al plan de local por semana |
| `plato_disponibilidad_local` colgando del plato | Calendario global del plato, no por semana | Catálogo recurrente global + materialización por semana (ver ❓) |
| `viandas` / `menu_semanal_dia_empresa_override` | (ya marcado en v2) | Subsumidos por compuesto v2 |

## Preguntas abiertas ❓ (a cerrar en `/plan-eng-review`)
1. **Ruteo empresa→menú** (la abre la decisión 1—N): con varios menús por semana y `menus_semanales` sin `empresa_id`, ¿cómo sabe cada empleado/empresa de QUÉ menú pedir? Hoy no hay ambigüedad (1 menú/semana). Opciones: tabla de asignación `empresa`↔`menu_semanal_id`, o `menus_semanales.empresa_id`, o visibilidad por menú. **Es la complejidad principal que introduce el modelo 1—N.**
2. **Estado**: ¿`semanas.estado` (borrador/publicado/cerrado a nivel semana), o el `estado` sigue por menú? Con 1—N menús, lo natural es que el estado siga por menú y la semana sea solo el contenedor.
3. **`menus_semanales.fecha_inicio`/`fecha_fin`**: ¿se dropean (derivables de `semanas`) o se mantienen denormalizados para no romper queries?
4. **Buffet/local**: ¿el calendario del plato (`plato_disponibilidad_local`) se parte en "catálogo recurrente global" + "materialización por semana", o se mueve entero a la semana? (Conecta con la limpieza ya hecha: sacamos el editor de la ficha del plato; su hogar es Cocina/semana.)

## Plan de migración (🟡 alto nivel — se fusiona con las 6 fases del compuesto v2)
Al no estar en producción se migra directo, con paridad shadow-read como gate (patrón `categorias-fase-b-paridad`). Orden tentativo (se afina en eng-review):
- **S0 — crear `semanas`** + backfill: una fila por cada `fecha_inicio` distinta de `menus_semanales` ∪ `semana_inicio` de `pedidos`/sugerencias.
- **S1 — agregar `semana_id` NULLABLE** a `menus_semanales`, `pedidos` y las 3 tablas de sugerencias + backfill por igualdad de fecha. Cero cambio de comportamiento.
- **S2 — flip de lecturas** a `semana_id` con paridad (leer por fecha == leer por `semana_id`) sobre todos los datos reales; incluye cocina (conteos por `semana_id`).
- **S3 — swap del UNIQUE** de `pedidos` a `(empleado_id, semana_id)`; `semana_id` NOT NULL.
- **S4 — limpieza**: drop `semana_inicio`/`fecha_inicio`/`fecha_fin` donde queden redundantes.
- **Intercalado con compuesto v2** (mismas tablas): el orden real combina S0–S4 con las fases 0–6 del compuesto en un solo roadmap — lo define el eng-review.

**Áreas de alto riesgo**: `pedidos` (cambia el invariante y el FK de semana), `cocina` (conteos por semana), y el ruteo empresa→menú (nuevo). Gate por fase: `npm test` secuencial verde + paridad verde antes de cada flip.

## Próximo paso
Correr `/plan-eng-review` sobre este modelo unificado (semana-raíz + compuesto v2) para lockear el plan de migración y resolver las 4 preguntas abiertas — sobre todo el **ruteo empresa→menú**, que es la consecuencia más pesada del modelo 1—N.

## LOCK — decisiones de /plan-eng-review (2026-07-18)

> **Scope reducido y lockeado.** El eng-review redujo el scope: **NO** se hace todo junto. Se **secuencia**.

### Scope (✅ decidido)
- ✅ **SECUENCIAR.** Migración 1 = **solo semana-raíz, cardinalidad 1—1**. Es la visión "la semana une todo", entregada con el menor blast radius y verificable sola.
- ✅ **Compuesto v2 → DIFERIDO** a una migración posterior (concern distinto: composición de platos; casi no pisa las tablas de semana-raíz).
- ✅ **Multi-menú 1—N y ruteo empresa→menú → DIFERIDOS** (scope especulativo, sin uso actual). El modelo 1—N descrito arriba en v3 queda como norte futuro, no como esta migración.

### Decisiones de arquitectura (✅ lockeadas)
1. ✅ **`menus_semanales.semana_id` FK + `UNIQUE(semana_id)`** (1—1 duro), **implementado completo** (D7 — cerró los agujeros de la voz externa):
   - **Guardia en `createMenuSemanal`** (`menus-semanales.service.js:38-56`): hoy NO chequea unicidad de semana (solo `duplicarMenuSemanal`); agregar rechazo de un 2º menú para una semana ya usada. Sin esto el `UNIQUE` choca en runtime por el path normal de creación.
   - **Remediación, no solo abort**: el pre-flight `SELECT fecha_inicio, COUNT(*) FROM menus_semanales GROUP BY fecha_inicio HAVING COUNT(*)>1` **presenta** los duplicados para resolver (elegir/mergear) antes de aplicar el UNIQUE — no aborta ciego.
   - **Regla de dueño**: bajo 1—1 el único menú de la semana es dueño de sus pedidos; `pedidos.menu_semanal_id` queda derivable de `semana_id` (ver follow-up).
2. ✅ **DROP `pedidos.semana_inicio` y `menus_semanales.fecha_inicio`/`fecha_fin`** — `semana_id` única fuente (D6, confirmado pese a la tensión). Consecuencias **obligatorias** (halladas por la voz externa, no opcionales):
   - **Reescribir el trigger `trg_bloquear_desactivar_vianda`** (mig. `1719000067000:226`) para usar `semana_id`/JOIN `semanas` en vez de `p.semana_inicio`. **CRÍTICO**: dropear la columna NO falla en el DROP (plpgsql no se parsea) → revienta en runtime al desactivar una vianda. Test de regresión obligatorio.
   - **`estadisticas`/`notificaciones` NO son swap de filtro**: hacen aritmética/templating sobre la fecha (`estadisticas.repository.js:21` `semana_inicio::date + offset`; `{{semana_inicio}}` en notificaciones). Requieren **JOIN `semanas`** para recuperar `fecha_inicio`/`fecha_fin`.
   - **`fecha_fin`**: moverlo a `semanas` presume semana canónica lunes+6. Pre-flight que verifique que no haya spans no-canónicos; reescribir los range-checks "¿menú vivo?" (`findMenuActivoPorFecha` `cocina.repository.js:22`, `menuActivo`, `menusPublicadosList`) contra `semanas.fecha_fin`.
   - **`pedido_sugerencia_opciones`** es `UNIQUE(semana_inicio, plato_id)` (shape distinto) → swap a `(semana_id, plato_id)`, no a `(empleado_id, semana_id)`.
   - Cada switch `semana_inicio`→`semana_id` es **regresión potencial** → paridad shadow-read obligatoria.
3. ✅ **Módulo `semanas` completo** (`routes/controller/service/repository/validation`, patrón estricto). Núcleo: `getOrCreateSemana(lunes)` idempotente que **consolida las 3 copias** del cálculo del lunes (`pedidos.service.js::lunesDeSemana`, `cocina.repository.js::lunesDe`, `pedidos.service.js::validarSemanaInicioLunes`). `semanas`: `id, fecha_inicio date UNIQUE NOT NULL (=lunes), fecha_fin date`.

### Pre-flight de datos obligatorio (antes del backfill)
La voz externa marcó que el backfill "por igualdad de fecha" asume lunes y nadie lo fuerza (`crearPedido` valida solo formato; `menus-semanales.schema` no exige lunes). Pre-flight que verifique y remedie ANTES de S1:
- No haya `fecha_inicio`/`semana_inicio` que NO sean lunes (romperían el join a `semanas` normalizado → S3 NOT NULL falla).
- No haya spans `menus_semanales` no-canónicos (fecha_fin ≠ fecha_inicio+6).
- No haya semanas con >1 menú (habilita el `UNIQUE(semana_id)`; con remediación, no abort ciego).

### Follow-up (TODO, no en esta migración)
- **`pedidos.menu_semanal_id` queda redundante bajo 1—1** (derivable de `semana_id`) y hoy es `ON DELETE SET NULL` (puede desincronizarse). La voz externa lo señaló como la redundancia genuina. Evaluar limpiarlo en una pasada posterior — NO en esta migración (mantener el diff acotado).

### Plan de migración lockeado (semana-raíz 1—1)
- **S0** — crear `semanas` + módulo; backfill: una fila por cada `fecha_inicio` distinta de `menus_semanales` ∪ `semana_inicio` de `pedidos`/sugerencias.
- **S1** — pre-flight dedup gate (aborta si multi-menú/semana). Agregar `semana_id` NULLABLE + índice a `menus_semanales`, `pedidos`, `pedido_sugerencias`, `sugerencias_empleados`, `pedido_sugerencia_opciones`; backfill por igualdad de fecha.
- **S2** — flip de lecturas a `semana_id` con **paridad shadow-read** (pedidos, cocina, finanzas, estadisticas, notificaciones) sobre todos los datos reales.
- **S3** — `semana_id` NOT NULL; `UNIQUE(menus_semanales.semana_id)`; swap `pedidos` UNIQUE → `(empleado_id, semana_id)` y los UNIQUE de las 3 tablas de sugerencias.
- **S4** — DROP `semana_inicio`/`fecha_inicio`/`fecha_fin` una vez toda lectura migrada y en verde.
- Gate por fase: `npm test` secuencial verde + paridad verde antes de cada flip.

### Tests obligatorios
- Pre-flight: dedup (>1 menú/semana), no-lunes, spans no-canónicos + rollback (down).
- Paridad shadow-read por cada consumidor (pedidos/cocina/finanzas/estadisticas/notificaciones) — antes de dropear.
- `UNIQUE(empleado_id, semana_id)` enforce 1/semana + upsert ON CONFLICT; `pedido_sugerencia_opciones` UNIQUE `(semana_id, plato_id)`.
- `getOrCreateSemana` idempotente + `UNIQUE(fecha_inicio)`; `validarSemanaInicioLunes` sigue exigiendo lunes; guardia de `createMenuSemanal` rechaza 2º menú/semana.
- **Regresión CRÍTICA**: `trg_bloquear_desactivar_vianda` sigue bloqueando la desactivación de vianda en uso tras el switch a `semana_id` (el test que hoy no existe para el path del trigger).

### NO en scope (diferido)
- Compuesto v2 (menú compuesto, componentes, override standing) — migración posterior.
- Multi-menú por semana (1—N) y ruteo empresa→menú — sin uso actual.
- Dropear `viandas` / `menu_semanal_dia_empresa_override` — pertenecen al compuesto v2.

### Implementación — S0 (✅ hecha, 2026-07-19)
Migración `1719000082000_create-semanas-table.js`: tabla `semanas` (`id, fecha_inicio date UNIQUE NOT NULL, fecha_fin date, timestamps`) + backfill de una fila por cada lunes distinto ya presente (`menus_semanales.fecha_inicio` ∪ `semana_inicio` de `pedidos`/3 sugerencias, normalizado con `date_trunc('week')`). No toca ninguna tabla vieja (cero cambio de comportamiento). Módulo `semanas` completo (`routes/controller/service/repository/validation`) montado en `/api/v1/semanas`: `getOrCreateSemana(fecha)` idempotente por lunes (upsert `ON CONFLICT (fecha_inicio)`, acepta `db` transaccional) + `lunesDe()` como fuente única del cálculo del lunes (las 3 copias históricas migran en fases siguientes). Endpoints admin: `GET /semanas`, `GET /semanas/actual`, `GET /semanas/:id`. Test `test/semanas.http-db.test.js` (3/3): idempotencia + normalización a lunes + `UNIQUE(fecha_inicio)` + endpoints. Lint limpio; suite: 155 pass, 3 fail preexistentes ajenos a S0 (2 pollution de `categorias-consistency` en menudb + 1 date-dependiente de `pedidos` por correr en domingo).

### Implementación — S1 (✅ hecha, 2026-07-19)
Migración `1719000083000_semanas-link-columns.js` (aditiva, cero cambio de comportamiento — nadie lee `semana_id` todavía):
- **Pre-flights que ABORTAN con mensaje claro** (remediación, no abort ciego — D7): fechas no-lunes, spans no canónicos (`fecha_fin ≠ fecha_inicio+6`), semanas con >1 menú. Datos actuales verificados limpios (0 en las tres).
- `semana_id integer` NULLABLE + FK `→ semanas(id)` + índice en `menus_semanales`, `pedidos`, `pedido_sugerencias`, `sugerencias_empleados`, `pedido_sugerencia_opciones`.
- Backfill por igualdad de semana (`s.fecha_inicio = date_trunc('week', <fecha>)::date`) + guard post-backfill que RAISE si queda algún `semana_id` NULL.
- Test `test/semanas-link.db.test.js` (10/10): sin NULL + **paridad** (`semana_id` resuelve a `date_trunc('week', fecha_vieja)`) por cada tabla. Suite: 165 pass, 3 fail preexistentes.

### Implementación — S2 (🟡 en curso, 2026-07-19)
Chunk 1 (trigger + write-flip) **hecho y verificado**:
- **Trigger reescrito** — migración `1719000084000_trigger-vianda-semana-id.js`: `trg_bloquear_desactivar_vianda` ahora lee la semana vía `JOIN semanas` sobre `pedidos.semana_id` y `menus_semanales.semana_id` (antes `p.semana_inicio` / `ms.fecha_fin`). Verificado con `pg_get_functiondef`: 0 refs a `semana_inicio`, usa `JOIN semanas`. Elimina el landmine de runtime antes del drop (S4).
- **Write-flip (puente de transición)** — migración `1719000085000_semana-id-autopopulate.js`: trigger `BEFORE INSERT/UPDATE` en `pedidos`/`menus_semanales`/3 sugerencias que auto-popula `semana_id` (getOrCreate concurrente-seguro). Garantiza que toda fila nueva quede linkeada sin tocar la transacción crítica de pedidos (write-before-read para que el trigger reescrito cuente pedidos nuevos). Se **retira en S4** (lee `semana_inicio`/`fecha_inicio`, que se dropean).
- Tests: `test/semanas-autopopulate.db.test.js` (write-flip). Suite: 166 pass, 3 fail preexistentes. Viandas (trigger) y pedidos (auto-populate) verdes.

Chunk 2 (flip de lecturas) — **en progreso**. Técnica: reemplazar el read de `p.semana_inicio` por `JOIN semanas se ON se.id = p.semana_id` + `se.fecha_inicio`. Paridad garantizada por el auto-populate (semana_id siempre en sync).
- ✅ **`cocina.repository`**: 4 conteos/agregados flipeados. Suite 166/3.
- ✅ **`estadisticas.repository`**: `filtrosPedido` calcula la fecha de servicio desde `se.fecha_inicio` + JOIN en las 4 queries por-empresa. Suite 167/2.
- ✅ **`notificaciones.repository`**: `findEmpleadosSinPedidoSemanal` filtra por `semana_id` (subquery a semanas). Los usos en `notificaciones.service.js` son a nivel app (leen `.fecha_inicio`/`.semana_inicio` de objetos de otras queries) → se resuelven cuando flipeen esas queries / en S4.
- ✅ **`pedidos.repository`**: 11 lecturas flipeadas a `JOIN semanas se ON se.id = <t>.semana_id` + `se.fecha_inicio AS semana_inicio` — SELECT-return (`findPedidoCabeceraById`, `findById`, `findAll`, `findHistorialByEmpleado`, `findSugerenciasByEmpleado`, `findSugerenciasAdmin`, `findOpcionesSugerencia`, `findOpcionesSugerenciaBySemanas`, `findItemConPedidoById`), WHERE (`findPedidoByEmpleadoSemana`, `findAll`, `findSugerenciasAdmin`, `findResumenSugerencias`, opciones-sugerencia) y ORDER (historial, sugerencias, opciones). GROUP BY suma `se.id` donde el SELECT agrega. Contrato de respuesta intacto (cada payload sigue exponiendo `semana_inicio`). Cubre las 3 tablas con `semana_id` (`pedidos`, `pedido_sugerencias`, `pedido_sugerencia_opciones`). Los write/constraint (`ON CONFLICT (empleado_id, semana_inicio)`, INSERT, RETURNING y sus WHERE de targeting: `upsertPedido`, `upsertSugerencia`, `replaceOpcionesSugerencia`, `cancelarPedidoByEmpleado`, `updateEstado`, `touchPedido`) **NO se tocan** hasta S3/S4. Suite 167/2 (2 fails `categorias-*` preexistentes).
- ✅ **`finanzas.repository`**: 6 funciones flipeadas (`findAplicacionesByPagoId`, `findPedidoFinancieroById`, `findPedidosParaAutoAplicar`, `listarPedidosPagos`, `cuentaCorriente`, `cuentaCorrienteCliente`) — SELECT-return, WHERE (3 filtros de `listarPedidosPagos`: `=`, `>=`, `<=`), ORDER (incluida la de auto-aplicación por deuda más vieja) y los 2 JSON de aplicaciones anidadas. Queries de pedido-main usan `JOIN semanas se` inner (pedido siempre tiene `semana_id`); las de `LEFT JOIN pedidos` (aplicaciones/pagos, `pa`) usan `LEFT JOIN semanas sea` para preservar NULL. Todas las escrituras van a `finanzas_pagos`/`finanzas_ajustes`/`finanzas_pago_aplicaciones` y no tocan `pedidos.semana_inicio`. **Verificación runtime**: 21 queries reales sin error SQL + payload con `semana_inicio`; smoke test transaccional del path JSON de aplicaciones confirma paridad `sea.fecha_inicio == pedido.semana_inicio`. Suite 167/2.

**Chunk 2 (flip de lecturas) — COMPLETO.** Todas las lecturas de `semana_inicio` (cocina, estadísticas, notificaciones, pedidos, finanzas) leen ahora vía `semana_id`. Los write/constraint (`ON CONFLICT (empleado_id, semana_inicio)`, INSERT, RETURNING y sus WHERE de targeting) permanecen sobre `semana_inicio` hasta S3/S4.

### Implementación — S3 (✅ hecho, 2026-07-21)
Migración `1719000086000_semana-id-constraints.js` (reversible, `down` verificado con rollback+re-apply):
- **`semana_id` NOT NULL** en las 5 tablas ancladas (`menus_semanales`, `pedidos`, `pedido_sugerencias`, `sugerencias_empleados`, `pedido_sugerencia_opciones`) — backfill S1 + auto-populate S2.1 garantizan no-null.
- **`UNIQUE(menus_semanales.semana_id)`** (1—1 duro semana↔menú), con **pre-flight** que RAISE listando los `semana_id` con >1 menú antes de aplicar (remediación D7).
- **Swap de UNIQUE**: `pedidos`, `pedido_sugerencias`, `sugerencias_empleados` → `(empleado_id, semana_id)`; `pedido_sugerencia_opciones` → `(semana_id, plato_id)` (shape distinto). Paridad 1—1 garantiza que el swap no introduce duplicados.
- **Código de app (mismo commit)**: `upsertPedido` y `upsertSugerencia` swappean `ON CONFLICT (empleado_id, semana_inicio)` → `(empleado_id, semana_id)`; el INSERT aún escribe `semana_inicio` y el trigger `set_semana_id` (BEFORE) deriva `semana_id` antes del árbitro del conflicto. **Guardia en `createMenuSemanal`** (`menus-semanales.service.js`): rechaza (409) un 2º menú para una semana ya usada, vía nuevo `repo.findBySemanaInicio` (antes solo `duplicarMenuSemanal` guardaba).
- **Tests**: `test/semanas-constraints.db.test.js` (5/5) — schema NOT NULL + UNIQUE swappeados, enforce 1 pedido/semana + upsert ON CONFLICT, enforce `(semana_id, plato_id)`, guardia de `createMenuSemanal`.
- **Fix de test-infra (consecuencia del UNIQUE)**: el seed histórico ocupa varias semanas reales; los fixtures de `pedidos` que crean menú para semanas temporales (pasada/actual) chocaban con el nuevo `UNIQUE(semana_id)`. Nuevo helper `liberarSemana(fechaInicio)` (cascade-delete del menú que ocupe esa semana; todas las FK a `menu_semanal_id` son `ON DELETE CASCADE`) llamado en `crearFixturePedido`. **Gate real = `npm test` (secuencial, `--test-concurrency=1`)**: 174/174. Nota: correr `node --test` sin `--test-concurrency=1` da falsos rojos por races entre files que comparten semana hardcodeada (`2026-08-10`) — usar siempre `npm test`.

### Implementación — S4 (✅ hecho, 2026-07-21) — MIGRACIÓN COMPLETA
Migración `1719000087000_drop-fecha-columns.js` (reversible, `down` re-agrega columnas + backfill desde semanas + recrea índices/triggers; verificado con rollback+re-apply). `semana_id` es ahora la **única fuente**.
- **Flip de lecturas de menú restantes** (S2 solo había flipeado `semana_inicio` de pedidos; las columnas de `menus_semanales` nunca se habían tocado): ~30+ sitios en `menus-semanales.repository` (findAll/countAll/findById/findPublicadoActivo/cambiarEstado/findByIdWithDias/findBySemanaInicio/findDisenoById/historialPorPlato), `pedidos.repository` (menuSemana/menuHoy/menusPublicadosList/menuActivo/menuActivoPorId/menuPublicadoPorSemana/findHistorialByEmpleado), `cocina.repository` (findMenuActivoPorFecha), `vista-semanal.repository` (findMenu), `notificaciones.repository` (findSemanaPublicadaObjetivo) → todos leen `se.fecha_inicio`/`se.fecha_fin` vía `JOIN semanas se ON se.id = ms.semana_id`, aliasando el contrato. `findHistorialByEmpleado` usa `LEFT JOIN semanas mse` sobre el menú (preserva NULL).
- **Flip de writes (setean semana_id directo)**: menú `create`/`update`/`duplicar` resuelven la semana con `semanasRepo.getOrCreateByLunes(lunes, fechaFin?)` (idempotente; `fechaFin` opcional → lunes+6) y cuelgan de `semana_id`; RETURNING vía CTE+JOIN para exponer `fecha_inicio`/`fecha_fin`. `updateMenuSemanal` traduce un cambio de fecha a reasignar `semana_id`. `upsertPedido`/`upsertSugerencia`/`replaceOpcionesSugerencia` hacen **getOrCreate de la semana inline en el write** (CTE `sem`, reemplaza al trigger retirado) + INSERT `semana_id`; `cancelarPedidoByEmpleado`/`updateEstado`/`touchPedido` targetean/RETURN vía `JOIN semanas`. `findPedidoByEmpleadoSemana` (que hacía `SELECT p.*`) suma `se.fecha_inicio AS semana_inicio` (el `p.*` ya no la trae).
- **Retiro del puente auto-populate** (`set_semana_id`, mig. 1719000085000) + **DROP** de `pedidos.semana_inicio`, `menus_semanales.fecha_inicio`/`fecha_fin`, y `semana_inicio` de las 3 sugerencias (índices caen en cascada). Pre-verificado: sin vistas dependientes; `trg_bloquear_desactivar_vianda` (reescrito en S2.1) usa `JOIN semanas` → sin landmine.
- **Seeds** (`seed-menus.js`, `seed-catalogo-menus.js`): INSERT de menú vía CTE getOrCreate de semana + `semana_id`.
- **Test-infra**: nuevo helper `insertarMenuSemana(db, {...})` (getOrCreate semana + cuelga menú de `semana_id`, devuelve fecha_inicio/fecha_fin) usado en todos los fixtures que creaban menús; `crearFixturePedido`/`crearPedidoDirecto`/`contarPedidosFixture` flipeados a `semana_id`. Borrados los tests de transición ya obsoletos (`semanas-autopopulate`, `semanas-link` — testeaban el trigger/paridad de columnas dropeadas; el NOT NULL lo cubre `semanas-constraints`).
- **Contrato de respuesta intacto**: todos los payloads siguen exponiendo `semana_inicio`/`fecha_inicio`/`fecha_fin` (aliasados desde `semanas`); `semana_inicio` sigue siendo campo de INPUT de la API (validación sin cambios).
- **Gate**: `npm test` (secuencial) **163/163**, lint limpio. Verificación runtime: 21 queries pedidos/finanzas + reads de menú + roundtrip create/update/cambiarEstado/duplicar/guardia sin error SQL.

**MIGRACIÓN "SEMANA COMO RAÍZ" COMPLETA (S0→S4).** `semanas` es el aggregate root; toda lectura/escritura pasa por `semana_id`. Follow-up diferido (no en scope): `pedidos.menu_semanal_id` redundante bajo 1—1 (ver LOCK Follow-up); compuesto v2 y multi-menú 1—N.

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 0 | — | — |
| Codex Review | `/codex review` | Independent 2nd opinion | 0 | — | — |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 1 | clean | 3 issues (2 arch + 1 cq), scope reduced; outside voice folded |
| Design Review | `/plan-design-review` | UI/UX gaps | 0 | — | — |
| DX Review | `/plan-devex-review` | Developer experience gaps | 0 | — | — |

- **CROSS-MODEL:** Outside voice (Claude subagent; Codex no instalado) encontró 8 hallazgos. El más grave — un **landmine oculto**: el trigger `trg_bloquear_desactivar_vianda` usa `pedidos.semana_inicio` y rompería en runtime (no en la migración) al dropear la columna. Se folded como requisito obligatorio + test de regresión. Tensiones D6 (dropear) y D7 (1—1 duro) presentadas al usuario: eligió dropear igual (con manejo obligatorio del trigger/estadísticas/notificaciones/fecha_fin) y mantener 1—1 completo (guardia + remediación + regla de dueño).
- **VERDICT:** ENG CLEARED (scope reducido a semana-raíz 1—1 como migración propia; compuesto v2 y multi-menú 1—N diferidos) — listo para implementar por fases S0–S4.

NO UNRESOLVED DECISIONS
