FROM node:20-bookworm-slim AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN corepack enable

FROM base AS build

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/api/package.json apps/api/package.json
COPY packages/shared/package.json packages/shared/package.json

RUN pnpm install --frozen-lockfile --filter @cast-loop/api...

COPY apps/api apps/api
COPY packages/shared packages/shared

RUN pnpm --filter @cast-loop/shared build
RUN pnpm --filter @cast-loop/api build
RUN pnpm deploy --filter @cast-loop/api --prod /prod/api

FROM node:20-bookworm-slim AS runtime

ENV NODE_ENV=production
ENV API_PORT=4000

WORKDIR /app

COPY --from=build /prod/api ./

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.API_PORT || 4000) + '/api/v1/health').then((response) => { if (!response.ok) process.exit(1); }).catch(() => process.exit(1))"

CMD ["node", "dist/main.js"]
