FROM node:22-bookworm-slim
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
RUN npm ci --no-audit --no-fund
COPY apps/web apps/web
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_AUTH0_DOMAIN
ARG NEXT_PUBLIC_AUTH0_CLIENT_ID
ARG NEXT_PUBLIC_AUTH0_AUDIENCE
ARG NEXT_PUBLIC_IMAGE_CDN_HOST
RUN node node_modules/next/dist/bin/next build apps/web --webpack && chown -R node:node apps/web/.next
USER node
ENV NODE_ENV=production
EXPOSE 3000
CMD ["node","node_modules/next/dist/bin/next","start","apps/web","--hostname","0.0.0.0","--port","3000"]
