# 每日喝水 - Web 版

简洁、清新的喝水记录 Web 应用，单容器 Docker 部署。

## 功能

- 💧 快速记录（100/200/500ml + 自定义）
- 🥤 4 种预设杯型 + 自定义
- 🎯 智能推荐目标（体重 × 活动 × 环境）
- 📊 折线趋势 + 时段分布（ECharts）
- 🔔 浏览器通知 + 智能提醒
- 🤖 AI 个性化饮水建议（可选，DeepSeek / 通义千问 / OpenAI）
- 🌤 首页实时天气（Open-Meteo）+ 自动 IP 定位 + Meteocons 动画图标
- ✈️ 飞书免登录 + 飞书消息喝水提醒（可选，见 [FEISHU.md](FEISHU.md)）
- 🏆 9 个成就徽章
- 📱 响应式（手机 + 桌面）
- 🔐 JWT 鉴权 + bcrypt 加密
- 🐳 Docker 一键部署

## 技术栈

- **前端**：Vue 3 + Vite + Pinia + Vant 4 + ECharts + Meteocons
- **后端**：Node.js 20 + Express + Prisma + JWT
- **AI**：DeepSeek（默认）/ 通义千问 / OpenAI（OpenAI 兼容协议）
- **天气**：Open-Meteo（无需 API Key）+ 正向地理编码
- **定位**：ip-api.com 代理 + 浏览器 Geolocation（混合模式）
- **数据库**：SQLite（单文件，零运维）
- **部署**：单容器 Docker，支持 GHCR + 阿里云 ACR 双镜像

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

## 高级特性

### 🤖 AI 个性化建议（可选）

首页“AI 小贴士”卡片会根据用户当天饮水进度、体重目标、时段生成 3 条个性化建议。

- **不配置 API Key 也能用**：默认返回精选推荐语料，不会报错
- **配置后启用**：填入 `AI_PROVIDER` + `AI_API_KEY`，调用的为 OpenAI 兼容协议
- **Provider 速查**：

  | provider | baseURL | 默认模型 | 申请地址 |
  |----------|---------|----------|----------|
  | `deepseek`（默认） | `https://api.deepseek.com/v1` | `deepseek-chat` | https://platform.deepseek.com/ |
  | `qwen` | `https://dashscope.aliyuncs.com/compatible-mode/v1` | `qwen-plus` | https://dashscope.console.aliyun.com/ |
  | `openai` | `https://api.openai.com/v1` | `gpt-4o-mini` | https://platform.openai.com/ |

- **调用参数**：`temperature=0.7`，`max_tokens=500`，超时 15s
- **Prompt 风格**：幽默、有温度，「该喝水了朋友」那种调皮语气（见 `server/src/ai/prompts/advice.js`）
- **缓存**：同一个用户同一天的 advice 会缓存 1 小时，避免重复调用费钱
- **手动刷新**：首页右上角 “🔄 换一批” 按钮可传 `fresh=1` 跳过缓存

### 🌤 首页天气

- **默认城市**：未设置 `DEFAULT_WEATHER_CITY` 时，浏览器自动调用 IP 定位（后端 `/api/geo/ip`）
- **手动选择**：点击首页状态行右侧的「📍城市名」药丸按钮，浏览器会请求位置授权
- **天气数据源**：[Open-Meteo](https://open-meteo.com/)（无需 API Key，免费）
- **图标**：[Meteocons](https://meteocons.com/) SVG 动画（内置 SMIL，零运行时），可动态染色

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
| `TZ` | 否 | `Asia/Shanghai` | 服务器时区 |
| `FEISHU_APP_ID` | 否 | - | 飞书 App ID（见 [FEISHU.md](FEISHU.md)） |
| `FEISHU_APP_SECRET` | 否 | - | 飞书 App Secret |
| `FEISHU_REDIRECT_URI` | 否 | - | 飞书授权回调地址 |
| `FEISHU_EVENT_ENCRYPT_KEY` | 否 | - | 飞书事件加密密钥（长连接模式） |
| `APP_BASE_URL` | 否 | - | 应用对外地址（提醒卡片跳转） |
| `ALIYUN_IMAGE` | 否 | ghcr.io | 镜像加速：设置阿里云 ACR 地址 |
| `AI_PROVIDER` | 否 | `deepseek` | LLM provider：`deepseek` / `qwen` / `openai` |
| `AI_API_KEY` | 否 | - | LLM API Key。**留空时首页 AI 卡片走推荐语料**，不会报错 |
| `AI_BASE_URL` | 否 | provider 默认 | 自定义 OpenAI 兼容 API 地址 |
| `AI_MODEL` | 否 | provider 默认 | 自定义模型名 |
| `AI_TIMEOUT_MS` | 否 | `15000` | LLM 调用超时（毫秒） |
| `DEFAULT_WEATHER_CITY` | 否 | 自动 IP 定位 | 首页天气默认城市（如 “北京”） |

### 数据持久化

- SQLite 数据库与 JWT 密钥都保存在容器内 **`/app/server/data`** 目录
- `docker-compose.yml` 已通过命名卷 `drink-water-data` 持久化
- **删除容器不会丢数据**，但删除卷（`docker-compose down -v`）会清空全部数据

### 升级 / 更新

```bash
git pull                        # 拉取最新代码
docker-compose up -d --build    # 重新构建并滚动更新
```

> **数据库结构自动同步**：容器每次启动都会执行 `prisma db push`，自动对齐最新 schema
> （新增表/字段无需手动迁移），随后幂等初始化演示数据，再启动服务。
> 升级后无需额外操作，重启容器即可。

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
| GET | /api/ai/config | AI 服务状态（是否启用 + provider） |
| GET | /api/ai/advice?fresh=1 | 生成个性化饮水建议（DeepSeek/Qwen/OpenAI） |
| GET | /api/weather?city=NAME | 按城市查实时天气 |
| GET | /api/weather?lat=X&lon=Y | 按坐标查实时天气 |
| GET | /api/geo/ip | IP 反查城市（首加载默认） |
| GET | /api/feishu/config | 飞书登录配置（是否启用 + 授权 URL） |
| POST | /api/feishu/bind | 飞书 OAuth 免登录（code 换 token） |
| POST | /api/feishu/merge | 绑定已有账号到飞书 |

## 目录结构

```
drink-water-web/
├── server/                 # Express + Prisma 后端
│   ├── prisma/
│   ├── src/
│   │   ├── routes/         # auth / user / records / stats / cups / reminders / ai / weather / geo
│   │   ├── middleware/     # auth + error
│   │   ├── ai/             # LLM client + prompt 模板 + 缓存
│   │   ├── feishu/         # 飞书 SDK 封装
│   │   ├── prisma/         # client + seed
│   │   └── reminder-worker.js
│   └── data/               # SQLite 文件（运行时生成）
├── web/                    # Vue 3 + Vite 前端
│   ├── src/
│   │   ├── views/          # Login / Home / History / Achievements / Profile / ...
│   │   ├── components/     # ProgressRing / RecordSheet / WeatherIcon
│   │   ├── composables/    # useWeather
│   │   ├── stores/         # Pinia
│   │   ├── api/            # axios 封装
│   │   └── router/
│   └── dist/               # 构建产物
├── prototype/              # 原型 HTML（独立）
├── .github/workflows/      # CI：Docker 双镜像发布（GHCR + ACR）
├── Dockerfile              # 单容器构建
├── docker-compose.yml
└── .env.example            # compose 环境变量模板（复制为 .env 使用）
```

## 路线图

- [x] AI 个性化饮水建议（DeepSeek/Qwen/OpenAI）
- [x] 首页实时天气 + 自动 IP 定位
- [x] 成就徽章 + 飞书卡片推送
- [x] 提醒时区处理（用户级时区）
- [x] 默认杯型自动关联提醒
- [ ] PWA 离线支持
- [ ] 暗色模式
- [ ] 多语言（i18n）
- [ ] 切换 PostgreSQL
- [ ] 健康周报推送