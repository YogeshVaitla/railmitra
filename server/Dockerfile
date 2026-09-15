# =============================================================================
# RailMitra API — Production Dockerfile
# Multi-stage build for minimal image size (~180MB vs ~1.2GB naive)
# =============================================================================

# ---- Stage 1: Build ----
FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependency manifests first for layer caching
COPY package.json package-lock.json ./
COPY prisma ./prisma/

# Install ALL deps (including devDependencies for tsc)
RUN npm ci --ignore-scripts

# Generate Prisma client
RUN npx prisma generate

# Copy source and compile TypeScript
COPY tsconfig.json ./
COPY src ./src/
RUN npx tsc

# ---- Stage 2: Production ----
FROM node:20-alpine AS production

WORKDIR /app

# Security: run as non-root user
RUN addgroup -g 1001 -S railmitra && \
    adduser -S railmitra -u 1001
    
# Copy dependency manifests and install production-only deps
COPY package.json package-lock.json ./
COPY prisma ./prisma/
RUN npm ci --omit=dev --ignore-scripts && \
    npx prisma generate && \
    npm cache clean --force

# Copy compiled JS from builder stage
COPY --from=builder /app/dist ./dist

# Set ownership
RUN chown -R railmitra:railmitra /app

USER railmitra

# Health check — hit the /api/health endpoint every 30s
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:${PORT:-3001}/api/health || exit 1

EXPOSE ${PORT:-3001}

# Prisma needs DATABASE_URL at runtime for migrations
# Run migrations then start the server
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
