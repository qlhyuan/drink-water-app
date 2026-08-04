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

生产部署建议用环境变量直接配置自己的管理员账号（无需手动注册）：

```bash
# 可选：创建管理员账号（首次启动自动创建，已存在则不覆盖密码）
ADMIN_USERNAME=admin ADMIN_PASSWORD=your-strong-password docker-compose up -d
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

### 账号与 JWT 密钥

- **管理员账号**：设置环境变量 `ADMIN_USERNAME` / `ADMIN_PASSWORD`
  （可选 `ADMIN_NICKNAME`），首次启动时自动创建；账号已存在则跳过，不会覆盖密码。
- **JWT 密钥**：无需手动生成。未设置 `JWT_SECRET`（或仍为占位值）时，
  系统启动会自动生成强随机密钥并持久化到 `data/.jwt-secret`，
  重启 / 重新部署后已登录用户 token 依然有效。
  仅当需要多实例共享同一密钥时，才需要显式固定 `JWT_SECRET`。

## 部署

### 方式一：Docker Compose（推荐）

#### 1. 获取代码

```bash
git clone https://github.com/qlhyuan/drink-water-app.git
cd drink-water-app
```

#### 2. 配置环境变量

复制模板并填写你的值（`.env` 不会被提交到 git，密码安全）：

```bash
cp .env.example .env
vim .env
```

`.env` 文件示例：

```ini
# 管理员账号：首次启动自动创建，已存在则不覆盖密码
ADMIN_USERNAME=admin
ADMIN_PASSWORD=请改成你的强密码
ADMIN_NICKNAME=管理员

# 浏览器跨域来源（一般留空即可，前端与后端同源部署）
CORS_ORIGIN=
```

#### 3. 构建并启动

```bash
docker-compose up -d --build
```

启动后：

- 访问 **http://localhost:8080**
- 用 `.env` 里配置的 `ADMIN_USERNAME` / `ADMIN_PASSWORD` 登录
- 也可以注册新账号，或使用演示账号 `demo / demo1234`

#### 4. 验证

```bash
docker-compose ps          # 状态应为 Up
curl http://localhost:8080/api/health   # 返回 {"ok":true,...}
```

### 方式二：直接使用预构建镜像

无需本地构建，直接拉取 GitHub Container Registry 镜像：

```bash
docker run -d \
  --name drink-water \
  --restart unless-stopped \
  -p 8080:3001 \
  -e ADMIN_USERNAME=admin \
  -e ADMIN_PASSWORD=你的强密码 \
  -v drink-water-data:/app/server/data \
  ghcr.io/qlhyuan/drink-water-app:latest
```

> 镜像内部已含前端构建产物（`web/dist`），单容器即可运行。

### 环境变量参考

| 变量 | 必填 | 默认值 | 说明 |
|------|------|--------|------|
| `ADMIN_USERNAME` | 否 | - | 管理员用户名，设置后首次启动自动创建 |
| `ADMIN_PASSWORD` | 否 | - | 管理员密码（需与 `ADMIN_USERNAME` 同时设置） |
| `ADMIN_NICKNAME` | 否 | 同用户名 | 管理员昵称 |
| `CORS_ORIGIN` | 否 | 空 | 跨域来源，逗号分隔；同源部署留空 |
| `JWT_SECRET` | 否 | 自动生成 | 固定 JWT 密钥（多实例共享时才需要） |
| `JWT_EXPIRES_IN` | 否 | `7d` | token 有效期 |
| `PORT` | 否 | `3001` | 容器内服务端口 |
| `DATABASE_URL` | 否 | `file:../data/prod.db` | SQLite 路径（一般不用改） |
| `NODE_ENV` | 否 | `production` | 运行环境 |

### 数据持久化

- SQLite 数据库与 JWT 密钥都保存在容器内 **`/app/server/data`** 目录
- `docker-compose.yml` 已通过命名卷 `drink-water-data` 持久化
- **删除容器不会丢数据**，但删除卷（`docker-compose down -v`）会清空全部数据

### 升级 / 更新

```bash
git pull                        # 拉取最新代码
docker-compose up -d --build    # 重新构建并滚动更新
```

使用预构建镜像时：

```bash
docker-compose pull && docker-compose up -d
```

### 备份

```bash
# 方式一：直接备份卷数据
docker run --rm -v drink-water-data:/data -v $(pwd):/backup alpine \
  tar czf /backup/drink-water-backup-$(date +%F).tar.gz -C /data .
```

```bash
# 方式二：使用 sqlite3 在线备份（数据库文件在 data/prod.db）
docker exec drink-water sqlite3 /app/server/data/prod.db ".backup /app/server/data/backup.db"
docker cp drink-water:/app/server/data/backup.db ./backup.db
```

### 常见问题

| 问题 | 解决 |
|------|------|
| 端口 8080 被占用 | 修改 `docker-compose.yml` 中 `ports: "8080:3001"` 的左侧端口 |
| 修改 `.env` 后不生效 | `docker-compose down && docker-compose up -d`（bootstrap 仅在启动时执行） |
| 想改管理员密码 | 用应用内个人设置修改，或删除用户后重新设置 `ADMIN_PASSWORD` 启动 |
| 换机器迁移 | 备份 `drink-water-data` 卷 → 新机器恢复卷后启动 |

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
├── docker-compose.yml
└── .env.example        # compose 环境变量模板（复制为 .env 使用）
```

## 路线图

- [ ] PWA 离线支持
- [ ] 暗色模式
- [ ] 多语言（i18n）
- [ ] 切换 PostgreSQL
- [ ] 健康周报推送