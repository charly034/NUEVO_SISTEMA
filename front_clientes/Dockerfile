FROM node:22-alpine AS build

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --include=optional
COPY . .
RUN npm run build

FROM nginxinc/nginx-unprivileged:1.29-alpine

ENV API_UPSTREAM=http://api:3000 \
    NGINX_ENVSUBST_FILTER=^API_UPSTREAM$

COPY nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:8080/ || exit 1
