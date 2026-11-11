FROM node:24.19.0-bookworm-slim AS build
WORKDIR /app
RUN npm install --global pnpm@11.25.0
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/package.json
COPY apps/mcp/package.json apps/mcp/package.json
RUN pnpm install --frozen-lockfile
COPY apps/web/src/server apps/web/src/server
COPY scripts/outreach-worker.ts scripts/outreach-worker.ts
RUN pnpm exec esbuild scripts/outreach-worker.ts --bundle --platform=node --target=node24 --format=esm --external:pg-native \
    '--banner:js=import {createRequire} from "node:module"; const require = createRequire(import.meta.url);' \
    --outfile=/bundle/outreach-worker.mjs

FROM node:24.19.0-bookworm-slim
WORKDIR /app
COPY --from=build --chown=node:node /bundle/outreach-worker.mjs /app/outreach-worker.mjs
ENV NODE_ENV=production DATABASE_POOL_MAX=2 OUTREACH_MAIL_TRANSPORT=simulation
USER node
ENTRYPOINT ["node", "/app/outreach-worker.mjs", "--run"]
