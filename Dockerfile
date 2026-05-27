# Base image
FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat python3 py3-pip
WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./
COPY prisma ./prisma/

# Install dependencies
RUN npm ci
RUN npx prisma generate
RUN python3 -m pip install --no-cache-dir --break-system-packages reportlab Pillow

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app

ARG USE_STUB_DATA=false

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Optional: use stub data only when explicitly requested
RUN if [ "$USE_STUB_DATA" = "true" ] && [ -d "data-stub" ]; then \
      rm -rf data && \
      cp -r data-stub data; \
    fi

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
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs
RUN apk add --no-cache python3 py3-pip
RUN python3 -m pip install --no-cache-dir --break-system-packages reportlab Pillow

# Copy necessary files
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma

# Copy pdfjs-dist worker files required at runtime (not bundled in standalone)
RUN mkdir -p ./node_modules/pdfjs-dist/legacy/build
COPY --from=builder /app/node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs ./node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs
COPY --from=builder /app/node_modules/pdfjs-dist/legacy/build/pdf.mjs ./node_modules/pdfjs-dist/legacy/build/pdf.mjs
COPY --from=builder /app/node_modules/pdfjs-dist/standard_fonts ./node_modules/pdfjs-dist/standard_fonts
COPY --from=builder /app/node_modules/pdf-parse ./node_modules/pdf-parse

# Copy Python PDF generators and supporting modules (not included in Next.js standalone)
COPY --from=builder /app/app/api/modulos/levantamento-fundeb/pdf ./app/api/modulos/levantamento-fundeb/pdf
COPY --from=builder /app/app/api/modulos/slides/pdf ./app/api/modulos/slides/pdf
COPY --from=builder /app/kit_padrao_pdf_rocha_prime ./kit_padrao_pdf_rocha_prime

# Set permissions
RUN chown -R nextjs:nodejs /app

USER nextjs

EXPOSE 3000

ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

# Start Next.js
CMD ["node", "server.js"]
