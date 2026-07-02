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

- No ejecutar `npm run seed:reset` ni `node scripts/seed-full-reset.js` en produccion.
- `seed-full-reset.js` es destructivo y requiere `SEED_FULL_RESET_CONFIRM=RESET_DEV_DATABASE`.
- Los passwords de seeds demo/dev deben venir por variables de entorno:
  `DEMO_ADMIN_PASSWORD`, `DEMO_CLIENT_PASSWORD`, `TEST_DATA_PASSWORD`,
  `SUPERADMIN_PASSWORD`, `DEFAULT_DEMO_PASSWORD` y `TEST_USER_PASSWORD`.
- Para crear un usuario del panel administrativo en desarrollo/staging, usar
  `npm run seed:admin` con `DEMO_ADMIN_EMAIL` y `DEMO_ADMIN_PASSWORD`
  configuradas. Si no existe ningun superadmin activo, el comando crea ese
  usuario como `superadmin`; si ya existe, lo crea como `admin`.
- Para una base demo completa desde cero, usar `npm run seed:setup` solo en
  desarrollo/testing. Es destructivo, exige `SEED_FULL_RESET_CONFIRM`, crea un
  superadmin con `SUPERADMIN_EMAIL`/`SUPERADMIN_PASSWORD` y un admin operativo
  con `DEMO_ADMIN_EMAIL`/`DEMO_ADMIN_PASSWORD`.

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
