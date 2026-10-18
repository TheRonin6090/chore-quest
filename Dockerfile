# syntax=docker/dockerfile:1

# 1. Front-end and TypeScript build. Runs on the build machine's own architecture: its output
#    (JS, CSS, PNG) is the same for every target, so it needn't be emulated when building for ARM64.
FROM --platform=$BUILDPLATFORM node:24-bookworm-slim AS build
# better-sqlite3 compiles from source when no prebuilt binary matches (e.g. Node 24 on ARM64).
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
COPY server/package.json server/
COPY web/package.json web/
RUN npm ci
COPY . .
RUN npm run build

# 2. Production dependencies for the target architecture. better-sqlite3 is native; build tools
#    are here only as a fallback in case no prebuilt binary matches, and don't reach the final image.
FROM node:24-bookworm-slim AS deps
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
COPY server/package.json server/
COPY web/package.json web/
RUN npm ci --omit=dev && npm cache clean --force

# 3. Runtime.
FROM node:24-bookworm-slim
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=8080 \
    DATA_DIR=/data \
    WEB_DIST=/app/web/dist
WORKDIR /app
COPY --from=deps /app/node_modules node_modules
COPY package.json ./
COPY server/package.json server/
COPY --from=build /app/server/dist server/dist
COPY --from=build /app/web/dist web/dist
# Used when there's no household.json in the data folder.
COPY household.example.json ./
RUN mkdir -p /data && chown node:node /data
USER node
VOLUME ["/data"]
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s \
  CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server/dist/index.js"]
