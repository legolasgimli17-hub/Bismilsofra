# Build from repository root: docker build -f apps/api/Dockerfile .
# No .env, credentials, production data or demo seed files are baked in.
FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production \
    API_BIND_HOST=0.0.0.0 \
    PORT=4000
COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/package.json
COPY apps/web/package.json ./apps/web/package.json
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force
COPY apps/api/src ./apps/api/src
COPY apps/api/sql ./apps/api/sql
USER node
EXPOSE 4000
STOPSIGNAL SIGTERM
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||'4000')+'/healthz',{signal:AbortSignal.timeout(3000)}).then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node","--experimental-strip-types","apps/api/src/server.ts"]
