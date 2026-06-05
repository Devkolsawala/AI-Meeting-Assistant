# MeetCopilot backend (apps/api) container for AWS App Runner (us-east-1, near Bedrock).
#
# Build from the REPO ROOT so the pnpm workspace, lockfile, and @meetcopilot/shared
# are in the build context:
#   docker build -f apps/api/Dockerfile -t meetcopilot-api .
#
# The image installs only the api + its workspace deps (not desktop/web), builds
# shared + api, prunes dev dependencies, and runs the compiled server.

# syntax=docker/dockerfile:1
FROM node:24-bookworm-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable

# ---------- build stage ----------
FROM base AS build
WORKDIR /repo

# Manifests first for layer caching. All workspace package.json files are needed
# so a frozen-lockfile install can resolve the workspace graph.
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/package.json
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY apps/desktop/package.json apps/desktop/package.json

# Install only what the api needs (api + its dependencies, e.g. shared).
RUN pnpm install --frozen-lockfile --filter @meetcopilot/api...

# Sources for the api and its workspace deps, then build.
COPY packages/shared packages/shared
COPY apps/api apps/api
RUN pnpm --filter @meetcopilot/shared build \
 && pnpm --filter @meetcopilot/api build

# Drop dev dependencies (typescript, turbo, eslint, …) from node_modules.
RUN pnpm prune --prod

# ---------- runtime stage ----------
FROM base AS runtime
WORKDIR /repo/apps/api
ENV NODE_ENV=production
# App Runner needs the server reachable on all interfaces; PORT must match the
# port configured on the App Runner service.
ENV HOST=0.0.0.0
ENV PORT=8787

# Copy the built workspace (dist + pruned node_modules; pnpm symlinks to
# @meetcopilot/shared are preserved within /repo).
COPY --from=build /repo /repo

EXPOSE 8787
CMD ["node", "dist/index.js"]
