# BhangariWala admin panel: static files served by nginx, which also forwards /api and /socket.io to the API.
# Build from the repo root: docker build -f docker/admin/Dockerfile .
FROM node:22-bookworm-slim AS build
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH CI=true
RUN corepack enable
WORKDIR /repo
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/api/package.json apps/api/
COPY apps/admin/package.json apps/admin/
COPY apps/mobile/package.json apps/mobile/
COPY packages/shared/package.json packages/shared/
RUN pnpm install --frozen-lockfile --filter "@bw/admin..." --ignore-scripts
COPY packages/shared packages/shared
COPY apps/admin apps/admin
RUN pnpm --filter @bw/shared build && pnpm --filter @bw/admin exec vite build

FROM nginx:1.27-alpine AS runtime
COPY docker/admin/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /repo/apps/admin/dist /usr/share/nginx/html
EXPOSE 8080
HEALTHCHECK --interval=15s --timeout=5s --retries=5 CMD wget -qO- http://127.0.0.1:8080/healthz || exit 1
