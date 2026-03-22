FROM node:22-slim AS builder

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-slim

RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg libva2 libva-drm2 mesa-va-drivers su-exec && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY --from=builder /app/build ./build
COPY --from=builder /app/package.json /app/package-lock.json ./
RUN npm ci --omit=dev

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

RUN mkdir -p /data

ENV NODE_ENV=production
ENV PORT=3000
ENV BODY_SIZE_LIMIT=Infinity
EXPOSE 3000

ENTRYPOINT ["/entrypoint.sh"]
