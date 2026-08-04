#!/bin/sh
set -e

cd /app/server

# 1) 用当前 schema 同步数据库结构（容器每次启动自动对齐，避免 P2022 列不存在）
echo "[entrypoint] 同步数据库结构 (prisma db push)..."
npx prisma db push --accept-data-loss

# 2) 初始化演示数据（幂等：demo 账号 upsert；失败不阻塞启动）
echo "[entrypoint] 初始化演示数据 (seed)..."
node src/prisma/seed.js || echo "[entrypoint] seed 跳过（非致命）"

# 3) 启动服务
echo "[entrypoint] 启动服务..."
exec node src/index.js
