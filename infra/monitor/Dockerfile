FROM node:24.19.0-bookworm-slim AS build
WORKDIR /app
RUN npm install --global pnpm@11.25.0
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/package.json
COPY apps/mcp/package.json apps/mcp/package.json
RUN pnpm install --frozen-lockfile
COPY infra/monitor/*.mjs apps/web/monitor/
RUN pnpm exec esbuild apps/web/monitor/run.mjs --bundle --platform=node --target=node24 --format=esm \
    '--banner:js=import {createRequire} from "node:module"; const require = createRequire(import.meta.url);' \
    --outfile=/out/run.mjs

FROM node:24.19.0-bookworm-slim
RUN apt-get update && DEBIAN_FRONTEND=noninteractive apt-get -y --no-install-recommends upgrade \
    && apt-get install -y --no-install-recommends util-linux \
    && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production MONITOR_STATE_DIR=/data/monitor
WORKDIR /app/monitor
COPY --from=build --chown=node:node /out/run.mjs ./run.mjs
COPY --chmod=755 infra/monitor/entrypoint.sh /usr/local/bin/calas-monitor
ENTRYPOINT ["/usr/local/bin/calas-monitor"]
