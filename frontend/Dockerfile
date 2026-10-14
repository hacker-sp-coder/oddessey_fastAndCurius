# Stage 1: Build the Vite production bundle
FROM node:22-bookworm-slim AS builder

WORKDIR /app

# Install dependencies first for efficient layer caching
COPY package.json package-lock.json* ./
RUN npm ci || npm install

# Copy application source code
COPY tsconfig.json tsconfig.node.json* vite.config.ts index.html ./
COPY src ./src
COPY public ./public

# Set build-time API base URL to relative /api
ENV VITE_API_BASE_URL=/api
RUN npm run build

# Stage 2: Serve using Nginx Alpine
FROM nginx:alpine AS runner

# Install curl for container health checks
RUN apk add --no-cache curl

# Copy custom Nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy compiled static assets from builder
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:80/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
