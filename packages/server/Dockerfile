# Build stage
FROM node:20-slim AS builder

WORKDIR /app

# Copy package files
COPY package.json ./
COPY ../pnpm-lock.yaml ./

# Install dependencies
RUN npm install -g pnpm && pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Build TypeScript files
RUN pnpm run build

# Production stage
FROM node:20-slim

WORKDIR /app

# Install runtime dependencies
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Copy built application from builder stage
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist

# Create directory for SQLite database and set permissions
RUN mkdir -p /data && \
    chown -R node:node /data && \
    chmod 755 /data

# Switch to non-root user
USER node

# Set environment variables
ENV NODE_ENV=production \
    PORT=8787 \
    DB_PATH=/data/messages.db

# Expose port (will be overridden by docker-compose)
EXPOSE ${PORT}

# Start the application
CMD ["node", "dist/index.js"]
