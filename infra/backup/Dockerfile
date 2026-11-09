FROM node:24.19.0-bookworm-slim AS build
WORKDIR /app
RUN npm install --global pnpm@11.25.0
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/package.json
RUN pnpm install --frozen-lockfile
COPY apps/web/src/server apps/web/src/server
COPY scripts/cloud-backup.ts scripts/cloud-backup.ts
RUN pnpm exec esbuild scripts/cloud-backup.ts --bundle --platform=node --target=node24 --format=esm --external:pg-native \
    '--banner:js=import {createRequire} from "node:module"; const require = createRequire(import.meta.url);' \
    --outfile=/bundle/cloud-backup.mjs

FROM postgres:17.11-bookworm@sha256:665dc7b37ac52a17e298511414c21d23ffa4e6a6ef6225b3e5d59c7afb35e994
RUN apt-get update && DEBIAN_FRONTEND=noninteractive apt-get -y --no-install-recommends upgrade \
    && rm -rf /var/lib/apt/lists/*
COPY --from=build /usr/local/bin/node /usr/local/bin/node
WORKDIR /app
COPY --from=build /bundle/cloud-backup.mjs apps/web/src/server/content/cloud-backup.mjs
COPY drizzle/*.sql drizzle/
ENV NODE_ENV=production POSTGRES_BIN=/usr/lib/postgresql/17/bin DATABASE_POOL_MAX=1
RUN node --version && ${POSTGRES_BIN}/pg_dump --version | grep -E 'PostgreSQL\) 17\.'
USER postgres
ENTRYPOINT ["node", "/app/apps/web/src/server/content/cloud-backup.mjs"]
CMD []
