# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Instrucciones generales

- Responder y documentar siempre en español.
- Usar nombres reales del proyecto; no inventar rutas, módulos, endpoints ni variables.
- Leer `AGENTS.md` y los archivos de `docs/ai/` antes de cualquier trabajo sustancial.
- Después de cambiar contratos, flujos, módulos, rutas, migraciones o variables de entorno, actualizar los archivos correspondientes en `docs/ai/`.

## Estructura del monorepo

```
NUEVO_SISTEMA/
├── API_LA_QUINTA/      # Backend Node.js + Express + PostgreSQL
├── front_menu/         # Panel admin (React 18 + Vite + Tailwind 3) — puerto 5174
├── front_clientes/     # App empleados (React 19 + Vite + Tailwind 4) — puerto 5175
├── docs/ai/            # Memoria técnica del proyecto (fuente de verdad)
└── compose.yaml        # Docker Compose completo
```

Todos los endpoints de la API viven bajo `/api/v1`. La API corre en el puerto 3000.

## Comandos de desarrollo

**API** (`API_LA_QUINTA/`):
```bash
npm ci && npm run migrate && npm run dev   # primera vez
npm run dev                                # arranque normal
npm run lint && npm test                   # validación
npm run migrate                            # aplicar migraciones pendientes
npm run migrate:rollback                   # rollback de última migración
```

**Panel admin** (`front_menu/`):
```bash
npm ci && npm run dev
npm run lint && npm run build              # validación
```

**App clientes** (`front_clientes/`):
```bash
npm ci && npm run dev
npm run lint && npm run build && npm test && npm run test:e2e   # validación completa
```

**Scripts raíz (Windows)**:
```
.\iniciar.bat       # levanta todo
.\detener.bat       # detiene todo
.\diagnostico.bat   # diagnóstico de puertos 3000/5174/5175
```

## Seeds

- `npm run setup` — solo migraciones; seguro en producción.
- `npm run seed:admin` — crea/actualiza usuario admin inicial (requiere `DEMO_ADMIN_EMAIL` y `DEMO_ADMIN_PASSWORD`).
- `npm run seed` — catálogo + menús históricos.
- `npm run seed:test-data` — 4 empresas, 25 empleados, pedidos QA. Requiere `TEST_DATA_PASSWORD`. No corre en producción.
- `npm run seed:demo-reset` — **destructivo**. Requiere `SEED_FULL_RESET_CONFIRM=RESET_DEV_DATABASE`. Nunca en producción.

## Arquitectura de la API

Cada módulo sigue el patrón estricto:

```
src/modules/<modulo>/
├── <modulo>.routes.js
├── <modulo>.controller.js
├── <modulo>.service.js
└── <modulo>.repository.js
```

Validación con **Zod** en `<modulo>.validation.js`. Todo el SQL vive en los repositorios. Las reglas de negocio críticas (pedidos, finanzas) viven en los servicios, nunca en el frontend.

**Entrypoints**:
- `src/server.js` → `src/app.js` → `src/routes/v1.routes.js`
- Orden de middleware en `app.js`: helmet → cors → json → morgan → rateLimit → rutas → notFoundMiddleware → **errorMiddleware al final**.

**Auth**: dos tokens independientes, no intercambiables.
- Cliente: `requireAuth` → puebla `req.empleado`
- Admin: `requireAdminAuth` → puebla `req.adminUser`

## Arquitectura del panel admin (`front_menu`)

- React Query (TanStack v5) para fetch/cache.
- `src/lib/apiClient.js` — cliente HTTP con interceptores y manejo de 401.
- `src/auth.js` — gestión de sesión admin.
- Cada entidad tiene su hook en `src/hooks/`.

**Patrón UX Simplicidad Radical** (aplicar siempre en vistas admin):
1. Lista/tabla en la página — solo columnas clave.
2. Click en fila o botón → abre `SideDrawer` (`width="md"` o `"lg"`).
3. Formulario completo dentro del drawer con Guardar + Cancelar al pie.
4. Acciones destructivas dentro del drawer, nunca en la tabla.
5. Listas largas colapsables: N primeros + "Ver todos (X)".

Ver `docs/ai/ux-admin-prompt.md` para el prompt completo de normalización UX — incluye reglas detalladas sobre filtros, KPIs, mobile, modales vs drawers y vocabulario del sistema.

Componentes base: `SideDrawer.jsx`, `Spinner.jsx`, `src/lib/toast.js`, `src/lib/confirm.js` (SweetAlert2).

**Página Clientes** (`/clientes?vista=X`): tab unificado con cuatro vistas — `empresas`, `planes`, `pagos`, `notificaciones`.

## Arquitectura de la app clientes (`front_clientes`)

- Mobile-first, React 19 + Tailwind 4.
- `src/services/api.js` y `src/services/apiCliente.js` — clientes HTTP con auth.
- `src/hooks/usePedidoSemanal.js` — orquesta carga, edición, confirmación y estado local del pedido (área de alto riesgo).
- `src/mappers/pedidoMapper.js` — puente entre contrato API y estado UI.
- Cache de menú: `useOpcionesMenu.js` con `queryKey ['opciones-menu-semana', empresaId, semanaId]`, staleTime 10 min.

## Reglas de negocio invariantes

- Un empleado no puede tener más de un pedido por semana: `UNIQUE (empleado_id, semana_inicio)`.
- `pedido_items` no puede repetir día dentro del mismo pedido.
- `sin_pedido=true` implica `plato_id NULL`.
- Crear/modificar/confirmar/cancelar pedidos usa **transacción**.
- Pedidos cliente deben usar identidad desde `req.empleado`, nunca de parámetros del body.
- Empresas usan soft delete (`activo=false` / `deleted_at`); nunca `DELETE` físico.
- Pagos se anulan con `estado=anulado`; nunca borrar físicamente en flujos normales.
- Las finanzas viven exclusivamente en `src/modules/finanzas`; `front_clientes` no es autoridad para `empresa_id` ni puede editar pagos.

## Migraciones

Las migraciones históricas **nunca se editan ni compactan**. Para agregar cambios de schema, siempre crear una migración nueva. Las migraciones aplicadas son inmutables.

## Escritura de archivos JSX en Windows

OXC (parser de Vite) rechaza BOM UTF-8 y comillas tipográficas (`"` `"`). Al escribir archivos `.jsx` desde PowerShell usar:

```powershell
[System.IO.File]::WriteAllBytes($path, $bytes)  # encoding sin BOM
```

Nunca usar heredoc de PowerShell con JSX (los `<>` rompen el parser).

## Docker

```bash
docker compose config
docker compose build
docker compose up --build -d
```

Si `docker` no está en PATH en Windows, anteponer:
```powershell
$env:PATH = 'C:\Program Files\Docker\Docker\resources\bin;' + $env:PATH
```

Los frontends usan `API_UPSTREAM=http://api:3000` dentro de Docker. En local dev usan proxy de Vite.

## Validación antes de finalizar

| Área modificada | Comandos requeridos |
|---|---|
| API | `npm run lint && npm test` |
| front_menu | `npm run lint && npm run build` |
| front_clientes | `npm run lint && npm run build && npm test` |
| front_clientes (flujo pedido) | + `npm run test:e2e` |

## Áreas de alto riesgo

- `API_LA_QUINTA/src/modules/pedidos` — reglas de negocio críticas y transacciones.
- `API_LA_QUINTA/src/modules/finanzas` — cuenta corriente, pagos, estado financiero.
- `API_LA_QUINTA/src/database/migrations` — schema histórico; no editar migraciones aplicadas.
- `API_LA_QUINTA/src/middlewares/auth.middleware.js` — afecta toda la autenticación.
- `front_clientes/src/hooks/usePedidoSemanal.js` — estado central del pedido.
- `front_clientes/src/mappers/pedidoMapper.js` — contrato API ↔ UI.
- `front_menu/src/lib/apiClient.js` — interceptores globales admin.

## Deuda técnica abierta relevante

- **debt-notificaciones-filtro-plan-legacy**: filtros de notificaciones aún usan plan legacy en lugar de `plan_id`.
- **debt-admin-auditoria-cobertura-parcial**: `admin_auditoria` no registra todos los CRUD sensibles.
- **debt-mis-sugerencias-parallel-flow**: `/api/v1/mis-sugerencias` y `/api/v1/pedidos/sugerencias` son sistemas paralelos sin consolidar.
- **debt-admin-xlsx-vulnerability**: `front_menu` usa `xlsx` para exportar pedidos a Excel; riesgo aceptado mientras sea requisito operativo.

Ver `docs/ai/60-debt.yaml` para el listado completo.

## Skill routing

When the user's request matches an available skill, invoke it via the Skill tool. When in doubt, invoke the skill.

Key routing rules:
- Product ideas/brainstorming → invoke /office-hours
- Strategy/scope → invoke /plan-ceo-review
- Architecture → invoke /plan-eng-review
- Design system/plan review → invoke /design-consultation or /plan-design-review
- Full review pipeline → invoke /autoplan
- Bugs/errors → invoke /investigate
- QA/testing site behavior → invoke /qa or /qa-only
- Code review/diff check → invoke /review
- Visual polish → invoke /design-review
- Ship/deploy/PR → invoke /ship or /land-and-deploy
- Save progress → invoke /context-save
- Resume context → invoke /context-restore
- Author a backlog-ready spec/issue → invoke /spec
