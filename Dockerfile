FROM node:22-slim AS builder
WORKDIR /app
# Install build dependencies for better-sqlite3
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx tsup src/index.ts --format esm

FROM node:22-slim
WORKDIR /app
# Install ca-certificates and better-sqlite3 runtime dependencies if any
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

ENV NODE_ENV=production
ENV PORT=3340
EXPOSE 3340

# SQLite data dir (use Railway volume mounted at /data)
ENV DATABASE_URL=/data/agora.db

CMD ["node", "dist/index.js"]
