# Build stage
FROM node:22-alpine AS builder
WORKDIR /app

COPY package*.json ./
COPY packages ./packages
COPY apps/api ./apps/api
COPY prisma ./prisma
COPY tsconfig.base.json ./

RUN npm ci
RUN npx prisma generate
RUN npm run build:packages
RUN npm run build --workspace=@propertyos/api

# Production runtime stage
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=4000

# Install openssl for Prisma runtime
RUN apk add --no-cache openssl dumb-init

COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/package.json ./apps/api/package.json
COPY --from=builder /app/prisma ./prisma

USER node
EXPOSE 4000

ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["node", "apps/api/dist/src/main.js"]
