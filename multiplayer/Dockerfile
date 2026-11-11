# ---- build ----
FROM node:22.23.4-bookworm-slim AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY tsconfig.json ./
COPY src ./src
# The lobby rooms import the shared wire protocol from outside src/.
COPY protocol ./protocol
RUN npm run build

# ---- runtime ----
FROM node:22.23.4-bookworm-slim
ENV NODE_ENV=production
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund

COPY --from=build /app/build ./build
COPY protocol ./protocol
COPY public ./public

EXPOSE 2567
CMD ["node", "build/index.js"]
