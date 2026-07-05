# La Quinta — sistema de menús y pedidos

Monorepositorio con tres aplicaciones:

- `API_LA_QUINTA`: API REST Node.js/Express y migraciones PostgreSQL.
- `front_menu`: panel administrativo React.
- `front_clientes`: aplicación React para empleados.

## Desarrollo local

Requisitos:

- Node.js 22
- PostgreSQL 15 o superior

Copiar `API_LA_QUINTA/.env.example` como `API_LA_QUINTA/.env`, completar las
variables y ejecutar:

```bash
cd API_LA_QUINTA
npm ci
npm run migrate
npm run dev
```

## Seeds y datos demo

- `npm run setup` es seguro para producción y ejecuta solo migraciones.
- `npm run seed` carga catálogo + menús históricos. Equivale a ejecutar
  `seed:catalogo` y luego `seed:menus`.
- `npm run seed:catalogo` carga guarniciones, platos fijos/especiales/ambos y
  metadata aproximada de platos.
- `npm run seed:menus` importa menús históricos desde CSV, días sin servicio e
  historial de uso.
- `npm run seed:admin` crea/actualiza el usuario inicial del panel admin con
  `DEMO_ADMIN_EMAIL` y `DEMO_ADMIN_PASSWORD`. Si no existe ningún superadmin
  activo, crea ese usuario como `superadmin`; si ya existe, lo crea como
  `admin`.
- `npm run seed:demo` crea datos demo no destructivos y completa perfiles demo
  existentes sin borrar datos ni cambiar contraseñas.
- `npm run seed:test-data` crea datos de prueba realistas: 4 empresas, 25
  empleados en total, pedidos de semanas anteriores, semana actual y semana
  próxima; además asegura menús de test publicados/cerrados y snapshot de plan
  en pedidos. Requiere `TEST_DATA_PASSWORD`, acepta `12345678` para QA local y
  no corre en producción.
- `npm run datos-prueba:limpiar` audita datos demo/QA conocidos en modo
  dry-run; `CLEAN_TEST_DATA_CONFIRM=ELIMINAR_DATOS_PRUEBA npm run
  datos-prueba:limpiar:apply` elimina empresas/empleados/pedidos/menús seed
  de prueba antes de preparar una base limpia.
- No ejecutar `npm run seed:demo-reset` ni `node scripts/seed-full-reset.js` en
  producción.
- `seed:demo-reset` es destructivo y requiere
  `SEED_FULL_RESET_CONFIRM=RESET_DEV_DATABASE`.
- Los passwords de seeds demo/dev deben venir por variables de entorno:
  `DEMO_ADMIN_PASSWORD`, `DEMO_CLIENT_PASSWORD`, `TEST_DATA_PASSWORD`,
  `SUPERADMIN_PASSWORD` y `DEFAULT_DEMO_PASSWORD`.
- Para una base demo completa desde cero, usar `npm run setup:demo` solo en
  desarrollo/testing. Es destructivo, exige `SEED_FULL_RESET_CONFIRM`, crea un
  superadmin con `SUPERADMIN_EMAIL`/`SUPERADMIN_PASSWORD` y un admin operativo
  con `DEMO_ADMIN_EMAIL`/`DEMO_ADMIN_PASSWORD`.
- `npm run seed:demo-profiles` completa datos demo faltantes de empresas y
  empleados ya existentes sin borrar datos ni cambiar contraseñas; no corre en
  `NODE_ENV=production`.

## Migraciones

Las migraciones históricas no se compactan ni se reescriben porque una base que
ya las ejecutó depende de esos nombres. Para una instalación nueva alcanza con:

```bash
cd API_LA_QUINTA
npm run setup
```

Solo conviene hacer un squash de migraciones si se confirma que todas las bases
pueden destruirse y recrearse desde cero.

En terminales separadas:

```bash
cd front_menu
npm ci
npm run dev
```

```bash
cd front_clientes
npm ci
npm run dev
```

## Docker Compose

Copiar `.env.docker.example` como `.env`, cambiar todas las claves y ejecutar:

```bash
docker compose config
docker compose build
docker compose up --build -d
```

Para publicar los frontends por Cloudflare Tunnel desde Docker, completar
`CLOUDFLARED_TUNNEL_TOKEN` en `.env` y levantar el perfil `tunnel`:

```bash
docker compose --profile tunnel up --build -d
```

En Cloudflare Zero Trust, configurar los public hostnames del tunnel asi:

- `dev.laquintacomidas.com` -> `http://clientes:8080`
- `devadmin.laquintacomidas.com` -> `http://admin:8080`

Servicios locales:

- API: `http://localhost:3000`
- Administración: `http://localhost:5174`
- Clientes: `http://localhost:5175`

La API ejecuta automáticamente las migraciones pendientes antes de iniciar.

En Windows, si `docker` no existe en PATH, instalar Docker Desktop y abrirlo antes
de correr Compose:

```powershell
winget install --id Docker.DockerDesktop -e --accept-source-agreements --accept-package-agreements
docker --version
docker compose version
```

Si el instalador solicita permisos de administrador o reinicio, completar esa
accion manualmente y volver a ejecutar `docker compose config`.

Si Docker Desktop esta instalado pero una terminal nueva no encuentra `docker`,
anteponer temporalmente el binario de Docker Desktop:

```powershell
$env:PATH = 'C:\Program Files\Docker\Docker\resources\bin;' + $env:PATH
docker --version
docker compose version
```

## Despliegue en Easypanel

Crear un proyecto con cuatro servicios.

### PostgreSQL

Crear un servicio PostgreSQL persistente y conservar su URL interna. Configurar:

```text
TZ=America/Argentina/Buenos_Aires
PGTZ=America/Argentina/Buenos_Aires
```

No publicar el puerto de PostgreSQL.

### API

- Directorio raíz: `API_LA_QUINTA`
- Método: Dockerfile
- Puerto: `3000`
- Health check: `/api/v1/health`

Variables obligatorias:

```text
NODE_ENV=production
PORT=3000
DATABASE_URL=postgresql://...
DB_SSL=false
JWT_SECRET=un-secreto-largo-y-aleatorio
JWT_EXPIRES_IN=7d
DB_POOL_MAX=10
DB_IDLE_TIMEOUT_MS=30000
DB_CONNECTION_TIMEOUT_MS=5000
APP_TIMEZONE=America/Argentina/Buenos_Aires
TRUST_PROXY_HOPS=1
CORS_ORIGINS=http://localhost:5174,http://localhost:5175,https://laquintacomidas.com,https://dev.laquintacomidas.com,https://devadmin.laquintacomidas.com
```

### Panel administrativo

- Directorio raíz: `front_menu`
- Método: Dockerfile
- Puerto: `8080`
- Dominio sugerido: `admin.example.com`
- Variable `API_UPSTREAM`: URL interna de la API, por ejemplo `http://api:3000`.

### Aplicación de clientes

- Directorio raíz: `front_clientes`
- Método: Dockerfile
- Puerto: `8080`
- Dominio sugerido: `pedidos.example.com`
- Variable `API_UPSTREAM`: URL interna de la API.

Si el nombre interno `api` no resuelve en Easypanel, usar como `API_UPSTREAM`
el dominio HTTPS público de la API.

## Verificaciones

```bash
cd API_LA_QUINTA && npm run lint && npm test
cd front_menu && npm run lint && npm run build
cd front_clientes && npm run lint && npm run build && npm test && npm run test:e2e
```

Smoke post-deploy:

1. `GET /api/v1/health` debe responder `200`.
2. Entrar al panel administrativo y validar dashboard, empresas, empleados,
   platos, guarniciones, semanas y pedidos.
3. Entrar como empleado demo, abrir Inicio, hacer o modificar un pedido semanal,
   recargar y validar persistencia en Historial.

Los archivos `.env`, dependencias, builds y configuración local de herramientas
están excluidos del repositorio.
