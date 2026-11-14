# Ask Righto hosted server: the single bundled file on a slim Node runtime.
#   docker build -t askrighto .
#   docker run -p 8080:8080 -e DATABASE_URL=... askrighto     → http://localhost:8080/mcp
# Commands in the image: `node askrighto.js migrate` and `node askrighto.js sync-energy`.
ARG NODE_IMAGE=node:22-alpine
FROM ${NODE_IMAGE} AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts
COPY tsconfig.json ./
COPY scripts ./scripts
COPY src ./src
RUN node scripts/build.mjs

FROM ${NODE_IMAGE}
LABEL org.opencontainers.image.source="https://github.com/feimacode/askrighto" \
      org.opencontainers.image.licenses="UNLICENSED"
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=8080
COPY --from=build /app/dist/askrighto.js /app/dist/askrighto.js.LEGAL.txt ./
USER node
EXPOSE 8080
# Liveness only: /healthz never touches the database. /readyz reports data readiness.
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1:${PORT}/healthz || exit 1
CMD ["node", "askrighto.js", "--http"]
