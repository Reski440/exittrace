# ExitTrace worker — Docker image (Playwright + Chromium)
# Base image already includes Node 20, Chromium and its system deps.
# Use this on Railway / Render / any host that runs Docker containers.
# Playwright needs at least 1 GB RAM — do NOT run this on a 512 MB
# free tier and expect stable results (see README, "Deploy the worker").
FROM mcr.microsoft.com/playwright:v1.48.2-noble

WORKDIR /app

# Install dependencies first (better layer caching).
COPY package.json package-lock.json ./
RUN npm ci

# Worker + engine code only (no Next.js dashboard needed in this image).
COPY lib ./lib
COPY worker ./worker
COPY tsconfig.json ./

ENV NODE_ENV=production
# Railway / Render set PORT automatically; worker/server.ts reads
# WORKER_PORT first, then PORT.
EXPOSE 4002

CMD ["npm", "run", "worker"]
