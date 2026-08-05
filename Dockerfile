# Base image — Debian slim (required for Playwright/Chromium)
FROM node:22-slim AS base

# Install dependencies only when needed
FROM base AS deps
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 python3-pip python3-venv \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./
COPY kit_padrao_pdf/requirements.txt ./kit_padrao_pdf/requirements.txt

# Install dependencies
#
# `electron` e `electron-builder` são devDependencies do app desktop (seção 10
# do CLAUDE.md) e o `npm ci` as instala junto. O binário do Electron tem mais de
# 100 MB e é baixado do GitHub no postinstall — no contêiner ele não serve para
# nada, e um download que falha derrubaria o build, que aqui é o deploy de
# produção. A variável pula só o binário; o pacote continua resolvendo.
ENV ELECTRON_SKIP_BINARY_DOWNLOAD=1
RUN npm ci
RUN python3 -m pip install --no-cache-dir --break-system-packages \
    -r kit_padrao_pdf/requirements.txt

# Install Playwright browsers (only Chromium, minimizes size)
RUN npx playwright install --with-deps chromium

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Disable analytics during build
ENV NEXT_TELEMETRY_DISABLED 1

# Increase Node.js memory for build
ENV NODE_OPTIONS="--max-old-space-size=4096"

# Build Next.js
RUN npm run build

# Production image
FROM base AS runner
WORKDIR /app

ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

# Create non-root user
RUN groupadd --system --gid 1001 nodejs
RUN useradd --system --uid 1001 nextjs

# Install runtime dependencies (Python for legacy PDF + Chromium for Playwright)
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 python3-pip \
    wget ca-certificates fonts-liberation libasound2 libatk-bridge2.0-0 \
    libatk1.0-0 libcups2 libdbus-1-3 libdrm2 libgbm1 libgtk-3-0 \
    libnspr4 libnss3 libx11-xcb1 libxcomposite1 libxdamage1 \
    libxrandr2 xdg-utils libxss1 libxshmfence1 libpango-1.0-0 \
    libpangocairo-1.0-0 libcairo2 libgdk-pixbuf2.0-0 \
    && rm -rf /var/lib/apt/lists/*
COPY kit_padrao_pdf/requirements.txt ./kit_padrao_pdf/requirements.txt
RUN python3 -m pip install --no-cache-dir --break-system-packages \
    -r kit_padrao_pdf/requirements.txt

# Copy necessary files
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Copy pdfjs-dist worker files required at runtime (not bundled in standalone)
RUN mkdir -p ./node_modules/pdfjs-dist/legacy/build
COPY --from=builder /app/node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs ./node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs
COPY --from=builder /app/node_modules/pdfjs-dist/legacy/build/pdf.mjs ./node_modules/pdfjs-dist/legacy/build/pdf.mjs
COPY --from=builder /app/node_modules/pdfjs-dist/standard_fonts ./node_modules/pdfjs-dist/standard_fonts
COPY --from=builder /app/node_modules/pdf-parse ./node_modules/pdf-parse

# Copy Playwright browser binaries from deps stage
COPY --from=deps /root/.cache/ms-playwright /home/nextjs/.cache/ms-playwright
RUN chown -R nextjs:nodejs /home/nextjs/.cache

# Copy Playwright Node.js package for runtime
COPY --from=deps /app/node_modules/playwright ./node_modules/playwright
COPY --from=deps /app/node_modules/playwright-core ./node_modules/playwright-core

# Copy Python PDF generators and supporting modules (not included in Next.js standalone)
COPY --from=builder /app/app/api/modulos/levantamento-fundeb/pdf ./app/api/modulos/levantamento-fundeb/pdf
COPY --from=builder /app/app/api/modulos/slides/pdf ./app/api/modulos/slides/pdf
COPY --from=builder /app/kit_padrao_pdf ./kit_padrao_pdf

# Copy bundled FNDE CSV data (fallback when gov.br blocks Cloud Run IPs)
COPY --from=builder /app/data/fnde ./data/fnde

# Copy the CAGED snapshot. Without it the Employment block falls back to
# downloading ~117MB from IPEADATA on every cold start (see
# core/lib/municipal-profile/emprego.ts).
COPY --from=builder /app/data/caged-municipios.json ./data/caged-municipios.json

# Copy the school-census equity dataset (cor/raça, indigenous, quilombola and
# rural schools). Built offline from INEP microdata — see
# scripts/dados/gerar-equidade-censo-municipal.mjs.
COPY --from=builder /app/data/inep-equidade-municipal.json ./data/inep-equidade-municipal.json

# Set permissions
RUN chown -R nextjs:nodejs /app

USER nextjs

EXPOSE 3000

ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

# Start Next.js
CMD ["node", "server.js"]
