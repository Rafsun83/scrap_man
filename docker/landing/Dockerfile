# BhangariWala public landing page: static files served by nginx, which also forwards the two public catalog
# endpoints to the API (the page shows today's rate board). Build from the repo root:
#   docker build -f docker/landing/Dockerfile .
FROM node:22-bookworm-slim AS build
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH CI=true
RUN corepack enable
WORKDIR /repo
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/api/package.json apps/api/
COPY apps/admin/package.json apps/admin/
COPY apps/landing/package.json apps/landing/
COPY apps/mobile/package.json apps/mobile/
COPY packages/shared/package.json packages/shared/
RUN pnpm install --frozen-lockfile --filter "@bw/landing..." --ignore-scripts
COPY packages/shared packages/shared
COPY apps/landing apps/landing
RUN pnpm --filter @bw/shared build && pnpm --filter @bw/landing exec vite build

FROM nginx:1.27-alpine AS runtime
COPY docker/landing/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /repo/apps/landing/dist /usr/share/nginx/html
EXPOSE 8080
HEALTHCHECK --interval=15s --timeout=5s --retries=5 CMD wget -qO- http://127.0.0.1:8080/healthz || exit 1
