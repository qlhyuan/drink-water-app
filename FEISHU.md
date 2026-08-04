# 飞书集成指南（免登录 + 喝水提醒）

> 让「每日喝水」在飞书内一键登录、免输账号密码，并通过飞书消息定时提醒喝水。
> 相比微信公众号方案：**无需认证服务号、免费、无"24 小时交互窗口"限制**，应用机器人可在用户授权后主动推送。

## 一、能做什么

| 能力 | 说明 |
|------|------|
| ✈️ 飞书一键登录 | 登录页出现「飞书一键登录」按钮 → 飞书授权 → 自动创建/登录账号，**免输密码** |
| 💧 喝水提醒 | 按用户设置的提醒时段（startTime 起每 interval 分钟一次，至 endTime），推送**飞书消息卡片**（含今日进度 + 「去记录喝水」按钮） |
| 🔗 身份绑定 | 首次用飞书登录自动创建账号；已有账号也可在个人中心绑定飞书 |

## 二、前置条件

- 飞书开放平台账号（https://open.feishu.cn/，免费，个人/团队均可）
- 一个公网可访问的域名（飞书授权回调需要；本地开发可用内网穿透）
- Node.js 20+（本项目已满足）

## 三、开放平台配置（一次性）

### 1. 创建企业自建应用

开放平台 → 开发者后台 → 创建企业自建应用，得到：

- **App ID**（形如 `cli_xxx`）
- **App Secret**

### 2. 开通能力

应用详情 → **添加应用能力**：

- ✅ **机器人**（用于发单聊消息提醒）
- ✅ **网页应用**（用于 OAuth 免登录）

### 3. 配置重定向 URL

应用详情 → **安全设置 → 重定向 URL**，添加：

```
https://你的域名/feishu/callback
```

> 必须是**真实可访问**的域名；本地调试可用 natapp / cpolar 等内网穿透临时域名。

### 4. 申请权限

应用详情 → **权限管理**，开通：

| 权限 | 用途 |
|------|------|
| `im:message`（获取与发送单聊、群组消息） | 机器人发喝水提醒 |
| `contact:user.base:readonly`（获取用户基本信息） | OAuth 拿 open_id / 昵称 / 头像 |

### 5. 发布应用

- 企业内使用：**创建版本 → 申请发布**（管理员审核，通常几分钟内）
- 若为个人开发测试：可在「开发配置 → 权限管理」下用**测试企业**或直接发布到自己的企业

## 四、环境变量

```bash
# server/.env（开发）或 docker-compose .env（部署）
FEISHU_APP_ID=cli_xxx
FEISHU_APP_SECRET=你的AppSecret
# 飞书授权回调地址（前端页面），必须与开放平台「重定向 URL」一致
FEISHU_REDIRECT_URI=https://你的域名/feishu/callback
# 应用对外地址（提醒卡片「去记录喝水」按钮跳转目标）
APP_BASE_URL=https://你的域名
```

> ⚠️ 本仓库根目录 `.env` 中已存在的 `FEISHU_APP_ID / FEISHU_APP_SECRET` 是 **QwenPaw 飞书通道**的凭证。
> 若要让「每日喝水」使用同一应用，需在飞书开放平台为该应用开启「机器人」+「网页应用」能力，
> 并配置重定向 URL；若不想共用，创建新的自建应用替换即可。

## 五、启动

```bash
# 开发
cd server && npm run dev

# Docker 部署（docker-compose.yml 已透传 FEISHU_* 环境变量）
cp .env.example .env   # 填好 FEISHU_APP_ID 等
docker compose up -d
```

启动日志出现 `[feishu-reminder] 提醒 Worker 已启动` 即成功。

## 六、工作流程

### 免登录

```
登录页「飞书一键登录」
  → 后端返回授权 URL（含 app_id / redirect_uri / scope）
  → 跳转飞书授权页（用户确认，仅首次）
  → 回调 /feishu/callback?code=xxx
  → 前端把 code POST /api/feishu/bind
  → 后端换 open_id：
      已有用户 → 直接签发 JWT
      首次     → 自动创建账号（feishu_xxx，随机密码）+ 默认提醒设置
  → 存 token，跳转首页，全程免输入 ✅
```

### 提醒推送

```
用户开启提醒并绑定飞书（reminder_settings 表）
  → Worker 每 30s 扫描（startReminderWorker）
  → 当前时间命中用户提醒时刻（startTime + n×interval ≤ endTime）
  → 查今日已喝量 → 组装消息卡片
  → POST /open-apis/im/v1/messages（receive_id_type=open_id）
  → 用户飞书收到「💧 该喝水啦」卡片 + 「去记录喝水」按钮 ✅
```

## 七、API 一览

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/feishu/config` | 飞书是否启用 + 授权 URL |
| POST | `/api/feishu/bind` | OAuth code 换登录 token（免登录核心） |
| POST | `/api/feishu/merge` | 当前登录账号绑定飞书（需登录态） |
| — | `src/feishu/client.js` | 飞书 API 封装（token 缓存 / OAuth / 发消息 / 卡片） |
| — | `src/reminder-worker.js` | 定时提醒 Worker |

## 八、常见问题

| 现象 | 原因 / 解决 |
|------|------------|
| 登录页没有飞书按钮 | 服务端未读到 `FEISHU_APP_ID / FEISHU_APP_SECRET`；检查 .env |
| 授权后报「redirect_uri 不匹配」 | 开放平台「重定向 URL」与 `FEISHU_REDIRECT_URI` 不一致（须完全一致，含 https） |
| bind 返回 400「code 无效」 | 授权码一次性，过期/重复使用会失败；重新点登录 |
| 提醒不推送 | ① 用户未绑定飞书（提醒页显示「未绑定」）② 用户提醒设置 enabled=false ③ 当前不在提醒时段 ④ 机器人未开通/应用未发布 |
| 消息发送报权限错误 | 开放平台未授予 `im:message` 权限，或应用版本未发布生效 |
| 收到消息但用户未使用过应用 | 机器人主动推送需用户授权过（用飞书登录过一次即可） |

## 九、安全说明

- App Secret 仅存服务端，绝不下发前端
- 用户 open_id 为应用维度唯一标识，仅用于绑定与推送
- 提醒频率完全尊重用户设置（默认 60 分钟间隔 + 夜间免打扰）
