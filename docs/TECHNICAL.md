# 每日喝水 - Web 版技术文档

> 响应式 Web 应用，单二进制 Docker 部署，零外部依赖（SQLite 内嵌）

## 1. 项目概述

把已有的"每日喝水"小程序改造为 Web 端响应式应用，支持浏览器访问（桌面 + 手机），通过 Docker 一键部署。

### 1.1 技术选型

| 类别 | 选型 | 理由 |
|------|------|------|
| 前端框架 | Vue 3 + Vite | 响应式生态成熟，构建快 |
| UI 组件 | Vant 4（移动端） + 自研（桌面端） | 移动端体验佳，桌面端用自定义布局 |
| 状态管理 | Pinia | Vue 3 官方推荐 |
| 路由 | Vue Router 4 | 标准方案 |
| HTTP 客户端 | Axios | 拦截器好用 |
| 后端 | Node.js 20 + Express | 全栈统一，Docker 友好 |
| ORM | Prisma | 类型安全，迁移方便 |
| 数据库 | SQLite (better-sqlite3) | 零配置，单文件，FPGrowth 场景足够 |
| 鉴权 | JWT + bcrypt | 无状态，密码安全 |
| 日志 | Winston | 业界标准 |
| 部署 | Docker + Docker Compose | 单文件镜像，一键起 |
| 进程管理 | PM2 (容器内) | 异常自动重启 |

### 1.2 功能规划

| 功能 | 小程序 | Web 版 | 备注 |
|------|--------|--------|------|
| 快速记录 | ✅ | ✅ | 100/200/500 + 自定义 |
| 预设杯型 | ✅ | ✅ | 4 个 + 自定义 |
| 拍照识别 | ✅ | ❌ | 移除 |
| 今日记录 | ✅ | ✅ | |
| 撤销记录 | ✅ | ✅ | |
| 历史柱状图 | ✅ | ✅ | echarts |
| 热力图 | ✅ | ✅ | 自绘 SVG |
| 目标设置 | ✅ | ✅ | 智能推荐 |
| 提醒设置 | ✅ | ✅ | 浏览器 Notification API |
| 成就系统 | ✅ | ✅ | 10+ 成就 |
| 好友排行 | ✅ | ⚠️ | 简化为"我的成就"（无需社交） |
| 微信运动 | ✅ | ❌ | 移除 |
| 微信登录 | ✅ | ❌ | 改为账号密码 |
| 周报 | ✅ | ✅ | |
| 健康周报推送 | ✅ | ⚠️ | 简化为页面 |

## 2. 系统架构

```
┌─────────────────────────────────────────────────┐
│         Browser (Desktop / Mobile)              │
│  ┌───────────────────────────────────────────┐  │
│  │  Vue 3 SPA (Vite build)                   │  │
│  │  - Pinia state                            │  │
│  │  - Vue Router                             │  │
│  │  - Vant 4 (mobile) / 自研 (desktop)       │  │
│  └───────────────────────────────────────────┘  │
└────────────────────┬────────────────────────────┘
                     │ HTTPS / JSON
                     ▼
┌─────────────────────────────────────────────────┐
│   Node.js Container (Express)                    │
│  ┌───────────────────────────────────────────┐  │
│  │  Middleware                                │  │
│  │  - helmet (安全头)                         │  │
│  │  - cors                                    │  │
│  │  - morgan (日志)                           │  │
│  │  - jwt auth                                │  │
│  │  - rate-limit                              │  │
│  └───────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────┐  │
│  │  Routes                                    │  │
│  │  /api/auth        注册/登录                │  │
│  │  /api/records     喝水记录 CRUD            │  │
│  │  /api/goal        目标                    │  │
│  │  /api/notify      提醒设置                │  │
│  │  /api/achievement 成就                    │  │
│  │  /api/stats       统计                    │  │
│  └───────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────┐  │
│  │  Services (业务层)                         │  │
│  │  - WaterService / GoalService / ...        │  │
│  └───────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────┐  │
│  │  Prisma ORM                                │  │
│  └───────────────────────────────────────────┘  │
└────────────────────┬────────────────────────────┘
                     │ Native driver
                     ▼
           ┌──────────────────┐
           │  SQLite file     │
           │  /data/app.db    │
           └──────────────────┘
```

## 3. 目录结构

```
drink-water-web/
├── docker-compose.yml
├── Dockerfile
├── .env.example
├── README.md
├── docs/
│   ├── TECHNICAL.md          # 本文档
│   ├── API.md                # API 接口文档
│   └── DEPLOYMENT.md         # 部署文档
├── server/                    # 后端
│   ├── package.json
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── migrations/
│   ├── src/
│   │   ├── index.js          # 入口
│   │   ├── app.js            # Express 实例
│   │   ├── config/
│   │   │   ├── index.js
│   │   │   └── logger.js
│   │   ├── middleware/
│   │   │   ├── auth.js
│   │   │   ├── error.js
│   │   │   └── rate-limit.js
│   │   ├── routes/
│   │   │   ├── auth.routes.js
│   │   │   ├── record.routes.js
│   │   │   ├── goal.routes.js
│   │   │   ├── notify.routes.js
│   │   │   ├── achievement.routes.js
│   │   │   └── stats.routes.js
│   │   ├── services/
│   │   │   ├── auth.service.js
│   │   │   ├── water.service.js
│   │   │   ├── goal.service.js
│   │   │   ├── notify.service.js
│   │   │   └── achievement.service.js
│   │   ├── utils/
│   │   │   ├── jwt.js
│   │   │   ├── validator.js
│   │   │   └── date.js
│   │   └── schedulers/
│   │       └── reminder.js   # 提醒定时任务
│   └── tests/
└── web/                       # 前端
    ├── package.json
    ├── vite.config.js
    ├── index.html
    ├── public/
    └── src/
        ├── main.js
        ├── App.vue
        ├── router/
        │   └── index.js
        ├── stores/
        │   ├── user.js
        │   ├── water.js
        │   └── goal.js
        ├── api/
        │   ├── request.js
        │   ├── auth.api.js
        │   ├── water.api.js
        │   └── ...
        ├── views/
        │   ├── Login.vue
        │   ├── Register.vue
        │   ├── Home.vue
        │   ├── History.vue
        │   ├── Goal.vue
        │   ├── Notify.vue
        │   ├── Achievements.vue
        │   └── Profile.vue
        ├── components/
        │   ├── RateRing.vue
        │   ├── CupQuick.vue
        │   ├── WeeklyChart.vue
        │   └── Heatmap.vue
        ├── layouts/
        │   ├── MobileLayout.vue
        │   └── DesktopLayout.vue
        ├── utils/
        │   ├── storage.js
        │   ├── date.js
        │   └── notify.js
        └── styles/
            ├── variables.scss
            └── global.scss
```

## 4. 数据模型

```prisma
// server/prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = "file:/data/app.db"
}

model User {
  id            Int       @id @default(autoincrement())
  username      String    @unique
  passwordHash  String
  nickname      String
  avatar        String?
  gender        Int       @default(0)
  weight        Float     @default(60)
  activityLevel String    @default("normal")  // low / normal / high
  dailyGoal     Int       @default(1500)
  weekGoal      Int       @default(5)
  notifySettings String?  // JSON 字符串
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  records      WaterRecord[]
  achievements UserAchievement[]
}

model WaterRecord {
  id        Int      @id @default(autoincrement())
  userId    Int
  amount    Int
  type      String   @default("quick")
  cupId     String?
  cupName   String?
  timestamp BigInt
  date      String   // YYYY-MM-DD
  hour      Int
  createdAt DateTime @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, date])
  @@index([userId, timestamp])
}

model UserAchievement {
  id         Int      @id @default(autoincrement())
  userId     Int
  code       String   // streak_3 / volume_100L
  unlockedAt DateTime @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, code])
}

model AchievementDef {
  id        Int      @id @default(autoincrement())
  code      String   @unique
  type      String   // streak / volume / special
  threshold Int
  icon      String
  title     String
  desc      String
  sort      Int      @default(0)
}

model ReminderLog {
  id        Int      @id @default(autoincrement())
  userId    Int
  time      String   // HH:mm
  sentAt    DateTime @default(now())
  skipped   Boolean  @default(false)
}
```

## 5. 核心 API 设计

### 5.1 认证

```
POST /api/auth/register
  { username, password, nickname }
  → { token, user }

POST /api/auth/login
  { username, password }
  → { token, user }

GET  /api/auth/me
  Authorization: Bearer <token>
  → { user }
```

### 5.2 喝水记录

```
POST /api/records
  { amount, type, cupId, cupName, timestamp? }
  → { recordId, todayAmount, recordCount }

GET  /api/records/today
  → { amount, goal, streak, records[] }

GET  /api/records?startDate=&endDate=&page=&pageSize=
  → { records, total, totalAmount }

DELETE /api/records/:id
  → { success }

POST /api/records/undo
  → { amount, record }
```

### 5.3 目标

```
GET  /api/goal
  → { dailyGoal, weekGoal }

PUT  /api/goal
  { dailyGoal, weekGoal }
  → { dailyGoal, weekGoal }
```

### 5.4 提醒

```
GET  /api/notify
PUT  /api/notify
  { enabled, startTime, endTime, interval, smartMode, quietEnabled }
```

### 5.5 成就

```
GET  /api/achievements
  → { unlocked[], locked[], stats }

POST /api/achievements/check
  → { newlyUnlocked[] }
```

### 5.6 统计

```
GET /api/stats/summary?days=7
  → { totalAmount, successRate, streak, avgAmount }

GET /api/stats/heatmap?days=30
  → { data: [{ date, amount, level }] }

GET /api/stats/chart?days=7
  → { data: [{ day, amount, percent }] }
```

## 6. 鉴权 / 安全

### 6.1 密码
- bcrypt 哈希，cost = 10
- 前端最少 6 位
- 登录失败次数限制（同 IP 5 次/分钟）

### 6.2 JWT
- HS256，secret 来自环境变量
- 过期 30 天
- payload: `{ userId, username, iat, exp }`

### 6.3 中间件
- `helmet` 设置安全头
- `cors` 限制 origin
- `express-rate-limit` API 限流
- 全局异常捕获
- 入参校验（zod）

### 6.4 数据隔离
- 所有查询强制带 `userId`
- 中间件从 JWT 注入 `req.userId`

## 7. 提醒机制

微信小程序用云函数定时推送，Web 端改为：

### 方案 A：浏览器端 Notification（推荐）
- 用户授权后，浏览器定时器在指定时间弹通知
- Service Worker 增强可见性
- 缺点：浏览器关闭后失效

### 方案 B：服务端推送（备用）
- 服务端用 `node-cron` 调度
- 配合 WebSocket 推送
- 需要长连接，复杂度高

**选 A**：默认 Web Notification + 离线可见性提示。

```
utils/notify.js
- requestPermission()
- scheduleReminder(settings)
- showNotification(title, body)
```

## 8. 部署架构

### 8.1 单容器方案（推荐）

```yaml
# docker-compose.yml
version: '3.8'
services:
  app:
    build: .
    ports:
      - "8080:8080"
    volumes:
      - ./data:/data
    environment:
      - NODE_ENV=production
      - JWT_SECRET=your-secret
      - DB_PATH=/data/app.db
    restart: unless-stopped
```

### 8.2 镜像策略

多阶段构建：

```dockerfile
# Stage 1: 构建前端
FROM node:20-alpine AS web-builder
WORKDIR /web
COPY web/package*.json ./
RUN npm ci
COPY web/ ./
RUN npm run build

# Stage 2: 安装后端
FROM node:20-alpine AS server-deps
WORKDIR /server
COPY server/package*.json ./
COPY server/prisma ./prisma
RUN npm ci
RUN npx prisma generate

# Stage 3: 运行时
FROM node:20-alpine
WORKDIR /app
RUN apk add --no-cache tini
COPY --from=server-deps /server/node_modules ./node_modules
COPY --from=server-deps /server/prisma ./prisma
COPY server/ ./
COPY --from=web-builder /web/dist ./public
RUN npx prisma migrate deploy
EXPOSE 8080
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "src/index.js"]
```

最终镜像大小：~200MB（包含前端构建产物 + Node 运行时）

### 8.3 反向代理（可选）

提供 nginx 配置模板：

```nginx
server {
  listen 80;
  server_name your-domain.com;

  location / {
    proxy_pass http://app:8080;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

## 9. 性能与扩展

### 9.1 缓存
- ETag / 304
- 静态资源强缓存（1 年）
- API 端使用内存缓存（LRU）查询统计

### 9.2 数据库
- 索引：`(userId, date)`、`(userId, timestamp)`
- 定期归档：90 天前记录可选择清理
- WAL 模式提高并发读写

### 9.3 监控
- `/health` 健康检查
- `/metrics` Prometheus 指标（可选）
- 日志结构化输出（JSON）

## 10. 里程碑

| 阶段 | 任务 | 工时 |
|------|------|------|
| M1 | 后端骨架 + 鉴权 + 用户 CRUD | 0.5d |
| M2 | 喝水记录 + 目标 + 提醒 API | 1d |
| M3 | 成就 + 统计 API | 0.5d |
| M4 | 前端骨架 + 路由 + 登录注册 | 1d |
| M5 | 首页 + 记录 + 历史 | 1.5d |
| M6 | 目标 + 提醒 + 成就页 | 1d |
| M7 | 响应式适配 + 自研组件 | 1d |
| M8 | Docker 化 + 部署文档 | 0.5d |
| M9 | 端到端测试 + 优化 | 1d |
| **合计** | | **8d** |

## 11. 风险与对策

| 风险 | 影响 | 对策 |
|------|------|------|
| SQLite 并发写 | 高流量下可能锁表 | 单机使用足够；预留 Postgres 切换路径 |
| 浏览器通知授权率低 | 提醒失效 | 多个授权入口 + 引导 + 降级为页面提示 |
| Docker 镜像大 | 部署慢 | 多阶段 + alpine + 合理缓存 |
| 国内 npm 慢 | 镜像构建慢 | Dockerfile 用国内镜像源 |

## 12. 后续演进

- [ ] 切换 PostgreSQL（多用户高并发）
- [ ] 接入 OAuth（GitHub / Google）
- [ ] PWA 改造（离线缓存 + 安装到桌面）
- [ ] 多语言 i18n
- [ ] 主题切换（深色模式）
- [ ] 数据导出（CSV / JSON）
- [ ] 移动端原生 App（Capacitor）

---

## 附录 A：环境变量

```bash
# .env.example
NODE_ENV=production
PORT=8080
JWT_SECRET=please-change-me-in-production
JWT_EXPIRES=30d
DB_PATH=/data/app.db
LOG_LEVEL=info
RATE_LIMIT_MAX=100
REMINDER_ENABLED=true
```

## 附录 B：API 响应规范

```json
{
  "code": 0,
  "message": "ok",
  "data": { ... }
}
```

错误码：
- `0` 成功
- `1000` 通用错误
- `2000` 未授权
- `2001` token 过期
- `3001` 业务参数错误
- `5000` 服务器错误
