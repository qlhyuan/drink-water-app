# 每日喝水 - Web 版

简洁、清新的喝水记录 Web 应用，单容器 Docker 部署。

## 功能

- 💧 快速记录（100/200/500ml + 自定义）
- 🥤 4 种预设杯型 + 自定义
- 🎯 智能推荐目标（体重 × 活动 × 环境）
- 📊 折线趋势 + 时段分布（ECharts）
- 🔔 浏览器通知 + 智能提醒
- 🏆 9 个成就徽章
- 📱 响应式（手机 + 桌面）
- 🔐 JWT 鉴权 + bcrypt 加密
- 🐳 Docker 一键部署

## 技术栈

- **前端**：Vue 3 + Vite + Pinia + Vant 4 + ECharts
- **后端**：Node.js 20 + Express + Prisma + JWT
- **数据库**：SQLite（单文件，零运维）
- **部署**：单容器 Docker

## 快速开始

### Docker（推荐）

```bash
docker-compose up -d --build
# 访问 http://localhost:8080
# 演示账号: demo / demo1234
```

### 本地开发

```bash
# 1. 启动后端
cd server
npm install
npm run setup      # 生成 prisma、建表、灌种子数据
npm run dev        # http://localhost:3001

# 2. 启动前端（新终端）
cd web
npm install
npm run dev        # http://localhost:5173
```

### 修改密钥

部署前务必修改 `.env` 或 `docker-compose.yml` 中的 `JWT_SECRET`。

## API 一览

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/auth/register | 注册 |
| POST | /api/auth/login | 登录 |
| GET | /api/user | 当前用户 |
| POST | /api/user/onboarding | 首次设置（推算目标） |
| GET | /api/records?date=YYYY-MM-DD | 某天记录 + 当日合计 |
| POST | /api/records | 新增记录 |
| DELETE | /api/records/:id | 删除记录 |
| POST | /api/records/undo | 撤销最近一条 |
| GET | /api/stats/overview?days=N | N 天趋势 + 达标天数 |
| GET | /api/stats/today | 今日 24h 时段分布 |
| GET / PUT | /api/cups | 自定义杯型 |
| GET / PUT | /api/reminders | 提醒设置 |

## 目录结构

```
drink-water-web/
├── server/             # Express + Prisma 后端
│   ├── prisma/
│   ├── src/
│   │   ├── routes/     # auth / user / records / stats / cups / reminders
│   │   ├── middleware/ # auth + error
│   │   └── prisma/     # client + seed
│   └── data/           # SQLite 文件（运行时生成）
├── web/                # Vue 3 + Vite 前端
│   ├── src/
│   │   ├── views/      # Login / Home / History / Achievements / Profile / ...
│   │   ├── components/ # ProgressRing / RecordSheet
│   │   ├── stores/     # Pinia
│   │   ├── api/        # axios 封装
│   │   └── router/
│   └── dist/           # 构建产物
├── prototype/          # 原型 HTML（独立）
├── Dockerfile          # 单容器构建
└── docker-compose.yml
```

## 路线图

- [ ] PWA 离线支持
- [ ] 暗色模式
- [ ] 多语言（i18n）
- [ ] 切换 PostgreSQL
- [ ] 健康周报推送