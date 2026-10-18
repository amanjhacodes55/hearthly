# ---- build ----
FROM node:20-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
ENV STANDALONE=1 NEXT_TELEMETRY_DISABLED=1
RUN npm run build:widget && npx next build

# ---- run (standalone: only the files the server needs) ----
FROM node:20-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=10000 HOSTNAME=0.0.0.0
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public
EXPOSE 10000
USER node
# NEXTAUTH_URL falls back to Render's public URL.
CMD ["sh", "-c", "export NEXTAUTH_URL=${NEXTAUTH_URL:-$RENDER_EXTERNAL_URL}; exec node server.js"]
