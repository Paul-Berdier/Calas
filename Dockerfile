FROM node:24.19.0-bookworm-slim AS base
WORKDIR /app
RUN npm install --global pnpm@11.25.0

FROM base AS dependencies
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json ./apps/web/package.json
RUN pnpm install --frozen-lockfile

FROM dependencies AS build
ENV ASTRO_TELEMETRY_DISABLED=1
# Public build metadata only. All database, auth, mail and storage secrets are
# supplied at runtime, never as image build arguments.
ARG SITE_URL=http://localhost:4321
ENV SITE_URL=${SITE_URL}
COPY assets ./assets
COPY scripts ./scripts
COPY apps/web ./apps/web
RUN pnpm build

FROM base AS production-dependencies
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json ./apps/web/package.json
RUN pnpm install --prod --frozen-lockfile

FROM node:24.19.0-bookworm-slim AS runtime
ENV NODE_ENV=production HOST=0.0.0.0 PORT=4321
WORKDIR /app/apps/web
COPY --from=production-dependencies --chown=node:node /app/node_modules /app/node_modules
COPY --from=production-dependencies --chown=node:node /app/apps/web/node_modules ./node_modules
COPY --from=build --chown=node:node /app/apps/web/dist ./dist
COPY --from=build --chown=node:node /app/apps/web/package.json ./package.json
USER node
EXPOSE 4321
HEALTHCHECK --interval=30s --timeout=6s --start-period=20s --retries=3 CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/api/health/',{signal:AbortSignal.timeout(5000)}).then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["node", "./dist/server/entry.mjs"]
