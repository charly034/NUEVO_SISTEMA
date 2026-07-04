# Memoria de contexto del proyecto

Actualizado: 2026-06-27

## Objetivo del sistema

Sistema de menus y pedidos para La Quinta. El repositorio contiene una API, un panel administrativo y una aplicacion cliente para empleados.

## Estructura principal

- `API_LA_QUINTA`: API REST en Node.js/Express con PostgreSQL, migraciones y seeds.
- `front_menu`: panel administrativo React para gestionar menus, platos, guarniciones, empresas, empleados, pedidos, historial, estadisticas y administradores.
- `front_clientes`: aplicacion React para empleados, enfocada en login, perfil, historial y pedido semanal.
- `docs`: documentacion funcional y tecnica del proyecto.

## Stack y comandos

API:

```bash
cd API_LA_QUINTA
npm ci
npm run migrate
npm run dev
```

Panel administrativo:

```bash
cd front_menu
npm ci
npm run dev
```

App clientes:

```bash
cd front_clientes
npm ci
npm run dev
```

Puertos locales esperados:

- API: `http://localhost:3000`
- Admin: `http://localhost:5174`
- Clientes: `http://localhost:5175`

Verificaciones recomendadas:

```bash
cd API_LA_QUINTA && npm run lint && npm test
cd front_menu && npm run lint && npm run build
cd front_clientes && npm run lint && npm run build
```

## Backend

La API usa:

- Express.
- PostgreSQL con `node-pg-migrate`.
- Autenticacion JWT.
- Validacion con Zod.
- Modulos por dominio: auth, admin-auth, empresas, empleados, menus semanales, menu publico, platos, guarniciones, pedidos, estadisticas, sugerencias y usuarios admin.

Migraciones relevantes ya presentes:

- Creacion y evolucion de empresas, empleados, platos, guarniciones, menus semanales y pedidos.
- Redisenio de pedidos.
- Auditoria de eventos de pedido.
- Estados/lifecycle de menus.
- Soporte multi-menu publicado.
- Restricciones de platos, guarniciones y nombres unicos.
- Eliminacion de tabla legacy `users`.

Seeds y utilidades:

- `seed-admin`
- `seed-demo`
- `seed-reset`
- Importacion de menus desde CSV.
- Seeds de platos fijos, menus, guarniciones y datos de prueba.

## Flujo de pedidos cliente

El flujo real esta documentado con mas detalle en `docs/pedidos-cliente.md`.

Endpoints principales usados por la app cliente:

- `GET /api/v1/pedidos/semanas`
- `GET /api/v1/menu/semanas/:semanaId/opciones?empresaId=:empresaId`
- `POST /api/v1/pedidos`
- `PUT /api/v1/pedidos/:pedidoId`
- `PATCH /api/v1/pedidos/:pedidoId/confirmar`

Reglas importantes:

- El frontend cliente no debe enviar `usuarioId` ni `empresaId` al crear, modificar o confirmar pedidos.
- El backend toma empleado y empresa desde el token.
- Un empleado solo puede operar pedidos propios y de su empresa.
- Debe existir un solo pedido por empleado y semana.
- Crear/modificar pedidos funciona como reconstruccion de items.
- Si llega un segundo `POST` para la misma semana y empleado, la regla actual esperada es upsert.
- Las validaciones de plazo, dia vencido, dia sin servicio, dia no laboral, plato y guarnicion deben ocurrir en backend.
- Si `sin_pedido` es `true`, no deben enviarse plato ni guarnicion.
- Si el plato requiere guarnicion, `guarnicion_id` es obligatorio.
- Si el plato no requiere guarnicion, no debe aceptarse guarnicion.

## Frontend cliente

La app cliente usa React 19, React Router 7, Tailwind 4, Vitest y Playwright.

Pantallas/componentes relevantes:

- Login, registro, recuperar password, perfil e historial.
- `PedidoPage` y `usePedidoSemanal`: pantalla y orquestador del pedido semanal.
- `SemanaContainer` y tarjetas de semana.
- Componentes de seleccion de platos, guarniciones, resumen y confirmacion.
- Hooks para auth, semanas, opciones de menu y seleccion diaria.

Cambios actuales sin commit detectados el 2026-06-27:

- `front_clientes/src/components/layout/PrivateRoute.jsx`
  - Se reemplazo el texto plano de verificacion por una pantalla de carga mobile usando `AppMobileShell` y `BottomNavigation`.
- El contenedor legacy `front_clientes/src/components/pedido/PedidoContainer.jsx` fue eliminado en la auditoria de limpieza del 2026-07-04; el flujo activo vive en `front_clientes/src/pages/PedidoPage.jsx` y `front_clientes/src/hooks/usePedidoSemanal.js`.
- `front_clientes/src/components/pedido/SemanaPedidoCard.jsx`
  - `ConfirmacionPedido` paso a cargarse con `lazy` y `Suspense`.
- `front_clientes/src/services/menuService.js`
  - Se agrego cache por `empresaId:semanaId` para `obtenerOpcionesMenuPorSemana`.
  - Si la promesa falla, se elimina la entrada del cache.

Motivo probable de esos cambios:

- Reducir parpadeos o pantallas vacias en carga.
- Evitar renderizar semanas antes de tener datos.
- Mejorar performance inicial separando la animacion de confirmacion.
- Evitar pedidos repetidos de opciones de menu por la misma semana.

## Frontend administrativo

El panel admin usa React 18, React Router 6, React Query, Tailwind 3 y Vite.

Secciones existentes:

- Dashboard.
- Semanas y detalle de semana.
- Platos.
- Guarniciones.
- Empresas.
- Pedidos de hoy y administracion de pedidos.
- Historial.
- Estadisticas.
- Sugeridor.
- Administradores.

Servicios/hooks conectan contra la API mediante `apiClient`.

## Despliegue

El README documenta despliegue en Easypanel con cuatro servicios:

- PostgreSQL.
- API.
- Panel administrativo.
- App clientes.

Variables criticas:

- `DATABASE_URL`
- `JWT_SECRET`
- `APP_TIMEZONE=America/Argentina/Buenos_Aires`
- `TRUST_PROXY_HOPS`
- `CORS_ORIGINS`
- `API_UPSTREAM` en frontends Dockerizados.

Los frontends usan Nginx con template `nginx/default.conf.template` para proxyear la API.

## Warnings conocidos

- `lottie-web` usa `eval` internamente por la animacion de confirmacion.
- Vite puede advertir chunks mayores a 500 kB.
- En esta maquina, `git status` muestra warnings por no poder acceder a `C:\Users\charl/.config/git/ignore`.

## Estado git al crear esta memoria

Rama actual:

```text
test...origin/test
```

Archivos modificados sin commit:

```text
front_clientes/src/components/layout/PrivateRoute.jsx
front_clientes/src/components/pedido/SemanaPedidoCard.jsx
front_clientes/src/services/menuService.js
```

Este archivo de memoria tambien queda como cambio nuevo hasta que se confirme en git.

## Siguientes pasos sugeridos

- Ejecutar lint/build de `front_clientes` para validar los cambios de carga, lazy import y cache.
- Probar flujo cliente completo: login, carga de semanas, seleccion, confirmacion, recarga y modificacion.
- Verificar que el cache de opciones no deje datos viejos si el admin publica o cambia menu durante la misma sesion.
- Resolver o aceptar el warning de `lottie-web` antes de endurecer CSP en produccion.
- Considerar lazy loading de pantallas grandes si el warning de chunk sigue creciendo.
