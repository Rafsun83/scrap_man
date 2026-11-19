# BhangariWala API. Build from the repo root: docker build -f docker/api/Dockerfile .
# The runtime stage gets a filtered production install (only the API's dependencies).
FROM node:22-bookworm-slim AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH CI=true
RUN corepack enable
WORKDIR /repo
# Every workspace manifest, so the frozen lockfile matches.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/api/package.json apps/api/
COPY apps/admin/package.json apps/admin/
COPY apps/mobile/package.json apps/mobile/
COPY packages/shared/package.json packages/shared/

FROM base AS build
RUN pnpm install --frozen-lockfile --filter "@bw/api..." --ignore-scripts
COPY packages/shared packages/shared
COPY apps/api apps/api
RUN pnpm --filter @bw/shared build && pnpm --filter @bw/api build

FROM base AS prod-deps
RUN pnpm install --frozen-lockfile --prod --filter "@bw/api..." --ignore-scripts

FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production PORT=3000
WORKDIR /app
# A filtered install puts the API's packages in apps/api/node_modules as relative links into node_modules/.pnpm;
# copying both keeps those links (and the @bw/shared link to packages/shared) valid under /app.
COPY --from=prod-deps /repo/node_modules ./node_modules
COPY --from=prod-deps /repo/apps/api/node_modules ./apps/api/node_modules
COPY --from=build /repo/packages/shared/package.json ./packages/shared/package.json
COPY --from=build /repo/packages/shared/dist ./packages/shared/dist
COPY --from=build /repo/apps/api/package.json ./apps/api/package.json
COPY --from=build /repo/apps/api/dist ./apps/api/dist
WORKDIR /app/apps/api
USER node
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=5 \
  CMD node -e "fetch('http://localhost:'+(process.env.PORT||3000)+'/api/v1/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
# Migrations, then categories and the first admin (idempotent), then the API.
CMD ["sh", "-c", "node dist/database/migrate.js && node dist/database/seed.js && node dist/main.js"]
