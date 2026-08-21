# Build stage
FROM node:22-alpine AS builder
WORKDIR /app

COPY package*.json ./
COPY packages ./packages
COPY apps/web ./apps/web
COPY tsconfig.base.json ./

RUN npm ci
RUN npm run build:packages
RUN npm run build --workspace=@propertyos/web

# Production runtime stage
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

RUN apk add --no-cache dumb-init

COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/apps/web/.next ./apps/web/.next
COPY --from=builder /app/apps/web/public ./apps/web/public
COPY --from=builder /app/apps/web/package.json ./apps/web/package.json

USER node
EXPOSE 3000

ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["npm", "run", "start", "--workspace=@propertyos/web"]
