FROM node:22-bookworm-slim
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/agent/package.json apps/agent/package.json
COPY packages/domain/package.json packages/domain/package.json
RUN npm ci --workspace @nomi/agent --include-workspace-root
COPY apps/agent apps/agent
COPY packages/domain packages/domain
WORKDIR /app/apps/agent
RUN npx tsc -p tsconfig.json
ENV NODE_ENV=production
CMD ["node", "dist/main.js", "start"]
