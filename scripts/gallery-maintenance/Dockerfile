FROM node:22.23.4-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --chown=node:node package.json package-lock.json ./
RUN npm ci --omit=dev
COPY --chown=node:node cloud-functions/artist-index ./cloud-functions/artist-index
COPY --chown=node:node scripts ./scripts
COPY --chown=node:node top-1000.json ./top-1000.json
USER node
RUN node -e "const s=require('./scripts/gallery-selection.cjs'); const m=require('./top-1000.json'); s.readGallerySelection('./top-1000.json',m.projectId)"
ENV OPENSEA_INTERVAL_MS=1000
ENTRYPOINT ["node", "scripts/gallery-maintenance/run.cjs"]
