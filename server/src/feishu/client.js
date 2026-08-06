/**
 * 飞书开放平台 API 客户端
 * - tenant_access_token 缓存（有效期约 2 小时，提前 5 分钟刷新）
 * - OAuth 授权码换用户信息（open_id / name / avatar）
 * - 应用机器人单聊消息推送
 *
 * 配置环境变量：
 *   FEISHU_APP_ID / FEISHU_APP_SECRET / FEISHU_REDIRECT_URI / APP_BASE_URL
 * 未配置 FEISHU_APP_ID 时，所有能力自动降级（enabled = false），不影响原有登录。
 */
import crypto from 'node:crypto';

const FEISHU_BASE = 'https://open.feishu.cn/open-apis';

const appId = () => process.env.FEISHU_APP_ID || '';
const appSecret = () => process.env.FEISHU_APP_SECRET || '';

export function isFeishuEnabled() {
  return !!(appId() && appSecret());
}

// ---------- tenant_access_token 缓存 ----------
let tokenCache = { token: '', expireAt: 0 };

export async function getTenantAccessToken() {
  if (!isFeishuEnabled()) throw new Error('飞书未配置（缺少 FEISHU_APP_ID / FEISHU_APP_SECRET）');
  if (tokenCache.token && Date.now() < tokenCache.expireAt) return tokenCache.token;

  const resp = await fetch(`${FEISHU_BASE}/auth/v3/tenant_access_token/internal`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ app_id: appId(), app_secret: appSecret() }),
  });
  const data = await resp.json();
  if (data.code !== 0) {
    throw new Error(`飞书 tenant_access_token 获取失败: ${data.code} ${data.msg}`);
  }
  // 有效期 7200s，提前 5 分钟刷新
  tokenCache = {
    token: data.tenant_access_token,
    expireAt: Date.now() + (data.expire - 300) * 1000,
  };
  return tokenCache.token;
}

// ---------- OAuth：授权码 → 用户信息 ----------
export function buildAuthorizeUrl(state = '') {
  const redirectUri = process.env.FEISHU_REDIRECT_URI || `${getBaseUrl()}/feishu/callback`;
  const params = new URLSearchParams({
    app_id: appId(),
    redirect_uri: redirectUri,
    scope: 'contact:user.base:readonly',
    state,
  });
  return `${FEISHU_BASE}/authen/v1/authorize?${params.toString()}`;
}

export async function getUserByCode(code) {
  // 授权码换 user_access_token
  const redirectUri = process.env.FEISHU_REDIRECT_URI || `${getBaseUrl()}/feishu/callback`;
  const tokenResp = await fetch(`${FEISHU_BASE}/authen/v2/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'authorization_code',
      client_id: appId(),
      client_secret: appSecret(),
      code,
      redirect_uri: redirectUri,
    }),
  });
  const tokenData = await tokenResp.json();
  if (tokenData.code !== 0) {
    throw new Error(`飞书 OAuth 换取 token 失败: ${tokenData.code} ${tokenData.msg}`);
  }
  const accessToken = tokenData.access_token || tokenData.data?.access_token;

  // 用 user_access_token 获取用户身份
  const userResp = await fetch(`${FEISHU_BASE}/authen/v1/user_info`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const userData = await userResp.json();
  if (userData.code !== 0) {
    throw new Error(`飞书获取用户信息失败: ${userData.code} ${userData.msg}`);
  }
  const info = userData.data;
  return {
    openId: info.open_id,
    unionId: info.union_id,
    name: info.name,
    avatar: info.avatar_url,
  };
}

// ---------- 消息推送 ----------
/**
 * 给单个用户发送飞书单聊消息（应用机器人）
 * @param {string} openId 接收者 open_id
 * @param {string} msgType text / post / interactive
 * @param {object|string} content 消息内容（interactive 为卡片 JSON）
 */
export async function sendMessage(openId, msgType, content) {
  const token = await getTenantAccessToken();
  const resp = await fetch(`${FEISHU_BASE}/im/v1/messages?receive_id_type=open_id`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      receive_id: openId,
      msg_type: msgType,
      content: typeof content === 'string' ? content : JSON.stringify(content),
    }),
  });
  const data = await resp.json();
  if (data.code !== 0) {
    throw new Error(`飞书消息发送失败: ${data.code} ${data.msg}`);
  }
  return data.data;
}

/** 提醒消息卡片：展示进度 + 一键记录按钮（回调式） + 打开应用 */
export function buildReminderCard({ nickname, drank, goal, percent, baseUrl, userId = 0 }) {
  // 与弹窗一致：一个"记录一杯水"主按钮，默认 250ml
  const DEFAULT_AMOUNT = 250;

  return {
    schema: '2.0', // 飞书卡片 JSON 2.0 = 共享卡片，支持 PATCH
    config: { wide_screen_mode: true },
    header: {
      template: 'green',
      title: { tag: 'plain_text', content: '💧 该喝水啦' },
    },
    body: {
      elements: [
        {
          tag: 'div',
          text: {
            tag: 'lark_md',
            content: `**${nickname || '朋友'}**，起来喝口水吧～\n今日进度 **${drank} / ${goal} ml**（${percent}%）\n\n> 小口慢饮，保持好状态 ☺️`,
          },
        },
        {
          tag: 'button',
          text: { tag: 'plain_text', content: `💧 记录一杯水 +${DEFAULT_AMOUNT}ml` },
          type: 'primary',
          margin: '8px 0 4px 0',
          value: { action: 'quick_record', userId, amount: DEFAULT_AMOUNT },
        },
        {
          tag: 'button',
          text: { tag: 'plain_text', content: '📝 详细记录' },
          type: 'default',
          margin: '4px 0',
          url: baseUrl,
        },
      ],
    },
  };
}

/** 已处理版卡片：按钮变灰，展示今日累计，不再可操作 */
export function buildDoneCard({ nickname, drank, goal, percent, baseUrl, justAdded }) {
  return {
    schema: '2.0',
    config: { wide_screen_mode: true },
    header: {
      template: 'green',
      title: { tag: 'plain_text', content: '✅ 已处理' },
    },
    body: {
      elements: [
        {
          tag: 'div',
          text: {
            tag: 'lark_md',
            content: `**${nickname || '朋友'}**，已记录 **+${justAdded} ml** ✅\n今日进度 **${drank} / ${goal} ml**（${percent}%）\n\n> 已处理，下一杯稍后再提醒～`,
          },
        },
        {
          tag: 'button',
          text: { tag: 'plain_text', content: '📝 查看详情' },
          type: 'default',
          margin: '8px 0 0 0',
          url: baseUrl,
        },
      ],
    },
  };
}

// ---------- 辅助 ----------
function getBaseUrl() {
  return (process.env.APP_BASE_URL || 'http://localhost:3001').replace(/\/$/, '');
}

/** 生成随机昵称后缀，避免自动创建账号时用户名冲突 */
export function randomSuffix() {
  return crypto.randomBytes(4).toString('hex');
}
