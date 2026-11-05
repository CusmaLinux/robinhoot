FROM node:22-bookworm-slim AS build
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@11.8.0 --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY tsconfig*.json nest-cli.json ./
COPY src ./src
RUN pnpm run build && pnpm prune --prod

FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ARG RELEASE_SHA=development
ENV RELEASE_SHA=$RELEASE_SHA
LABEL org.opencontainers.image.source="https://github.com/CusmaLinux/robinhoot"
LABEL org.opencontainers.image.revision=$RELEASE_SHA
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --chown=node:node scripts/start-container.sh ./scripts/start-container.sh
USER node
EXPOSE 3000
CMD ["sh", "scripts/start-container.sh"]
