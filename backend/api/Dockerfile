# Stage 1: Build TypeScript and compile native better-sqlite3
FROM node:22-bookworm-slim AS builder

WORKDIR /app

# Install build essentials for native better-sqlite3 compilation
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json* tsconfig.json ./
RUN npm ci || npm install

COPY src ./src
RUN npm run build

# Stage 2: Production runtime image
FROM node:22-bookworm-slim AS runner

WORKDIR /app

# Install curl for container health check
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json* tsconfig.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY src ./src
COPY tests ./tests

# Ensure storage directories exist inside the container
RUN mkdir -p /app/storage/uploads /app/storage/temp /app/storage/reports

ENV NODE_ENV=production
ENV PORT=4000
ENV DATABASE_PATH=/app/storage/pitches.db
ENV UPLOAD_DIR=/app/storage/uploads
ENV TEMP_DIR=/app/storage/temp
ENV FIXTURES_DIR=/app/fixtures

EXPOSE 4000

HEALTHCHECK --interval=10s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:4000/api/health || exit 1

CMD ["node", "dist/index.js"]
