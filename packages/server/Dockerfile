# Base stage
FROM node:20-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN npm install -g pnpm@10
WORKDIR /app

# Builder stage
FROM base AS builder
COPY . /app
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
RUN pnpm run build:server
RUN pnpm deploy --filter=server --prod /prod/server

# Production stage
FROM base

## Install runtime dependencies
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

## Copy built application from builder stage
COPY --from=builder /prod/server /app

## Create directory for SQLite database and set permissions
RUN mkdir -p /data && \
    chown -R node:node /data && \
    chmod 755 /data

## Switch to non-root user
USER node

## Set environment variables
ENV NODE_ENV=production \
    PORT=8787 \
    DB_PATH=/data/messages.db

## Expose port (will be overridden by docker-compose)
EXPOSE ${PORT}

## Start the application
CMD ["node", "dist/index.js"]
