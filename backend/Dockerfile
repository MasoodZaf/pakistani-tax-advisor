# Backend Dockerfile
#
# Runs on Debian bookworm-slim (not Alpine) because Puppeteer needs a proper
# Chromium install with glibc — Alpine ships musl and Chromium's official
# builds won't work. If Puppeteer is later dropped (reports.js was the only
# caller), this can move back to node:18-alpine for a smaller image.
FROM node:18-bookworm-slim

ENV PUPPETEER_SKIP_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium \
    NODE_ENV=production

# System deps: Chromium + the minimum fonts/libs to render PDFs, plus curl
# for the HEALTHCHECK below.
RUN apt-get update && apt-get install -y --no-install-recommends \
      chromium \
      ca-certificates \
      fonts-liberation \
      libnss3 \
      libatk1.0-0 \
      libatk-bridge2.0-0 \
      libdrm2 \
      libxkbcommon0 \
      libxcomposite1 \
      libxdamage1 \
      libxfixes3 \
      libxrandr2 \
      libgbm1 \
      libasound2 \
      curl \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install dependencies (production only). PUPPETEER_SKIP_DOWNLOAD above keeps
# npm from pulling its own ~170 MB Chromium — we use the distro package.
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Copy source
COPY . .

# Non-root runtime user
RUN groupadd -r --gid 1001 nodejs \
 && useradd -r --uid 1001 --gid nodejs --no-create-home nodejs \
 && chown -R nodejs:nodejs /app
USER nodejs

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3001/api/health || exit 1

CMD ["npm", "start"]
