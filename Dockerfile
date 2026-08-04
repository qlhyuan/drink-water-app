# ---------- 前端构建 ----------
FROM node:20-alpine AS web-build
WORKDIR /app/web
COPY web/package*.json ./
RUN npm install --no-audit --no-fund
COPY web/ ./
RUN npm run build

# ---------- 后端 + 前端产物 ----------
FROM node:20-alpine
WORKDIR /app
RUN apk add --no-cache openssl

# 先只拷 package.json 装依赖（利用缓存层）
COPY server/package*.json ./server/
RUN cd server && npm install --omit=dev --no-audit --no-fund

# 再拷全部后端源码（含 prisma schema），然后 generate
COPY server/ ./server/

COPY --from=web-build /app/web/dist ./web/dist

ARG JWT_SECRET=change-me-in-production
ENV NODE_ENV=production \
    PORT=3001 \
    DATABASE_URL="file:../data/prod.db" \
    JWT_SECRET=${JWT_SECRET} \
    CORS_ORIGIN=""

WORKDIR /app/server
RUN mkdir -p data && \
    npx prisma generate && \
    npx prisma db push --skip-generate && \
    node src/prisma/seed.js || true

EXPOSE 3001
CMD ["node", "src/index.js"]