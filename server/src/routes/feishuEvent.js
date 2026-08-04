/**
 * 飞书长连接事件处理（WSClient 模式）
 * - 通过 @larksuiteoapi/node-sdk 启动 WebSocket 客户端
 * - 监听 card.action.trigger_v1：用户点击卡片按钮
 * - 处理器返回新卡片 → SDK 自动 PATCH 原消息
 */
import lark from '@larksuiteoapi/node-sdk';
import dayjs from 'dayjs';
import prisma from '../prisma/client.js';
import { buildDoneCard, isFeishuEnabled } from '../feishu/client.js';

let wsClient = null;
let larkClient = null; // 用于拿到 tenant_access_token 调更新 API（SDK 已自带，但保险起见保留）

/**
 * 启动飞书长连接客户端
 * - 未配置 FEISHU_APP_ID 时跳过
 * - 已配置时启动 WSClient，监听 card.action.trigger_v1
 */
export function startFeishuEventListener() {
  if (!isFeishuEnabled()) {
    console.log('[feishu-event] 未配置 FEISHU_APP_ID，长连接事件监听未启动');
    return;
  }

  const appId = process.env.FEISHU_APP_ID;
  const appSecret = process.env.FEISHU_APP_SECRET;

  // 业务客户端：用于在处理器里调飞书 API（如需要主动发消息）
  larkClient = new lark.Client({ appId, appSecret, loggerLevel: lark.LoggerLevel.info });

  const eventDispatcher = new lark.EventDispatcher({
    encryptKey: process.env.FEISHU_EVENT_ENCRYPT_KEY || '',
    loggerLevel: lark.LoggerLevel.info,
  }).register({
    'card.action.trigger_v1': async (data) => {
      console.log('[feishu-event] 收到卡片点击事件');
      return handleQuickRecord(data);
    },
  });

  wsClient = new lark.WSClient({
    appId,
    appSecret,
    loggerLevel: lark.LoggerLevel.info,
  });

  try {
    wsClient.start({ eventDispatcher });
    console.log('[feishu-event] 长连接已启动');
  } catch (e) {
    console.error('[feishu-event] 启动失败:', e.message);
    // 30 秒后重试
    setTimeout(() => startFeishuEventListener(), 30_000);
  }
}

/** 停止长连接（用于 graceful shutdown） */
export function stopFeishuEventListener() {
  if (wsClient && typeof wsClient.disconnect === 'function') {
    try {
      wsClient.disconnect();
    } catch (e) {
      console.warn('[feishu-event] 断开失败:', e.message);
    }
  }
}

/**
 * 处理"一键记录"按钮点击
 * - 校验参数 + 校验操作者身份
 * - 写库
 * - 返回 buildDoneCard() → SDK 自动更新原卡片
 */
async function handleQuickRecord(data) {
  try {
    const event = data?.event || {};
    const action = event.action || {};
    const value = action.value || {};
    const ctx = event.context || {};
    const operator = event.operator || {};

    if (value.action !== 'quick_record') {
      return {}; // 不是我们的按钮，原样 200
    }

    const userId = Number(value.userId);
    const amount = Number(value.amount);

    if (!Number.isInteger(userId) || !Number.isInteger(amount)) {
      console.warn('[feishu-event] 参数非法:', value);
      return {};
    }
    if (amount < 10 || amount > 3000) {
      console.warn('[feishu-event] amount 越界:', amount);
      return {};
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      console.warn(`[feishu-event] 用户不存在 userId=${userId}`);
      return {};
    }

    // 安全：操作者 open_id 必须匹配该用户绑定
    if (operator.open_id && user.feishuOpenId && operator.open_id !== user.feishuOpenId) {
      console.warn(
        `[feishu-event] open_id 不匹配 user=${user.feishuOpenId} operator=${operator.open_id}`,
      );
      return {};
    }

    // 写记录
    await prisma.drinkRecord.create({
      data: {
        userId: user.id,
        amount,
        cupType: 'quick_feishu',
        cupEmoji: '💧',
      },
    });

    // 重新计算今日累计
    const start = dayjs().startOf('day').toDate();
    const end = dayjs().endOf('day').toDate();
    const agg = await prisma.drinkRecord.aggregate({
      where: { userId: user.id, recordedAt: { gte: start, lte: end } },
      _sum: { amount: true },
    });
    const drank = agg._sum.amount || 0;
    const goal = user.goal || 2000;
    const percent = Math.min(100, Math.round((drank / goal) * 100));

    // 返回新卡片 → SDK 会自动更新原消息
    console.log(`[feishu-event] 已记录 +${amount}ml user=${user.id} 进度=${drank}/${goal}ml`);
    return buildDoneCard({
      nickname: user.nickname || user.username,
      drank,
      goal,
      percent,
      baseUrl: (process.env.APP_BASE_URL || 'http://localhost:3001').replace(/\/$/, ''),
      justAdded: amount,
    });
  } catch (e) {
    console.error('[feishu-event] 处理失败:', e);
    return {}; // 返回空对象表示不更新卡片
  }
}