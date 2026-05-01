# ── Build stage ───────────────────────────────────────────────────────
FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsup.config.ts tsconfig.json ./
COPY src/ src/
RUN npm run build

# ── Run stage ─────────────────────────────────────────────────────────
FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist/ dist/

EXPOSE 3000
CMD ["node", "dist/http-server.js"]
