FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./
COPY shared/package.json shared/
COPY server/package.json server/
COPY client/package.json client/

# Install all dependencies
RUN npm ci

# Copy source code
COPY shared/ shared/
COPY server/ server/
COPY client/ client/
COPY tsconfig.base.json ./

# Build shared (TypeScript)
RUN npm run build -w shared

# Build client (Vite) - pass Google Client ID as build arg
ARG VITE_GOOGLE_CLIENT_ID
ENV VITE_GOOGLE_CLIENT_ID=$VITE_GOOGLE_CLIENT_ID
RUN npm run build -w client

# Build server (TypeScript)
RUN npm run build -w server

# --- Production stage ---
FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./
COPY shared/package.json shared/
COPY server/package.json server/

# Install production dependencies only
RUN npm ci --omit=dev -w server
# shared is a workspace dependency, copy it
COPY shared/ shared/

# Copy built server
COPY --from=builder /app/server/dist server/dist/

# Copy built client
COPY --from=builder /app/client/dist client/dist/

# Copy migrations next to compiled DB code (connection.ts looks for ./migrations relative to __dirname)
COPY server/src/db/migrations server/dist/db/migrations/

# Environment
ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001

# Start server
CMD ["node", "server/dist/index.js"]
