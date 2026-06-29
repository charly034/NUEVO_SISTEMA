# Front clientes - La Quinta

Aplicacion React/Vite para empleados que cargan y consultan pedidos semanales.

## Comandos

```bash
npm run dev
npm run lint
npm run build
npm test
npm run test:e2e
```

## Desarrollo local

El dev server usa el puerto `5175`. En Windows, el arranque recomendado desde la raiz del repo es:

```bat
iniciar.bat
```

Ese script levanta API, admin, clientes y Cloudflare Tunnel en ventanas visibles. Para evitar modulos React cacheados entre reinicios, el Vite config de desarrollo:

- fuerza prebundle con `npm run dev -- --force` desde `iniciar.bat`;
- sirve headers `Cache-Control: no-store`;
- agrega un query de sesion a imports relativos de `src`.

## API

El cliente usa `VITE_API_URL` si existe. Si no existe, usa `/api/v1`, que funciona tanto localmente con proxy Vite como desde Cloudflare Tunnel/Nginx.

No usar un fallback hardcodeado a `localhost` para llamadas del navegador: desde celulares o navegadores externos, `localhost` apunta al dispositivo del usuario y no a la API local.
