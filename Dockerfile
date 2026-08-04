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
# --omit=dev 不装 devDependencies；prisma CLI 单独补装（--no-save 不改 package.json），
# 供启动时 prisma db push 同步数据库结构使用
RUN cd server && npm install --omit=dev --no-audit --no-fund \
    && npm install --no-save --no-audit --no-fund prisma@5.22.0 \
    # 飞书 SDK 同时打包了 ES + CJS 两份，删 ES 目录节省 ~3.7M
    && rm -rf node_modules/@larksuiteoapi/node-sdk/es \
    # protobufjs 有大量本地化文件，实际只用到根目录的少量
    && rm -rf node_modules/protobufjs/google node_modules/protobufjs/src

# 再拷全部后端源码（含 prisma schema），然后 generate
COPY server/ ./server/

COPY --from=web-build /app/web/dist ./web/dist

# 启动入口：先同步数据库结构 + 初始化演示数据，再启动服务
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

ENV NODE_ENV=production \
    PORT=3001 \
    DATABASE_URL="file:../data/prod.db" \
    CORS_ORIGIN=""

WORKDIR /app/server
RUN mkdir -p data && npx prisma generate

EXPOSE 3001
# 每次启动自动对齐数据库 schema（新增字段/表无需手动迁移）
CMD ["docker-entrypoint.sh"]
