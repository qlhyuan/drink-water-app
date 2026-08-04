import { Router } from 'express';
import crypto from 'node:crypto';
import prisma from '../prisma/client.js';
import dayjs from 'dayjs';
import { asyncHandler, ApiError } from '../utils/asyncHandler.js';
import { buildDoneCard, updateMessage } from '../feishu/client.js';

const router = Router();

const ENCRYPT_KEY = () => process.env.FEISHU_EVENT_ENCRYPT_KEY || '';

/** 解密飞书事件 payload（AES-256-CBC，key 由 encrypt_key 经 SHA256 派生） */
function decryptPayload(encryptStr) {
  const raw = ENCRYPT_KEY();
  if (!raw) throw new Error('未配置 FEISHU_EVENT_ENCRYPT_KEY');
  const key = crypto.createHash('sha256').update(raw).digest();
  const buf = Buffer.from(encryptStr, 'base64');
  const iv = buf.subarray(0, 16);
  const data = buf.subarray(16);
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
  let dec = decipher.update(data);
  dec = Buffer.concat([dec, decipher.final()]);
  return JSON.parse(dec.toString('utf8'));
}

/**
 * 飞书事件订阅入口
 * 1) URL 验证：challenge 字段原样返回
 * 2) 事件回调：处理 card.action.trigger（用户点击了卡片按钮）
 */
router.post(
  '/event',
  asyncHandler(async (req, res) => {
    // 加密传输（推荐）：body 含 { encrypt: "..." }
    // 明文传输（开发用）：body 含 { type, event, ... }
    let payload = req.body;
    if (payload?.encrypt) {
      try {
        payload = decryptPayload(payload.encrypt);
      } catch (e) {
        console.error('[feishu-event] 解密失败:', e.message);
        // 解密失败也要返回 200，避免飞书重试
        return res.json({ code: 0, msg: 'ok' });
      }
    }

    // 1) URL 验证
    if (payload?.type === 'url_verification') {
      return res.json({ challenge: payload.challenge });
    }

    // 2) 事件回调
    const event = payload?.event || {};
    const header = payload?.header || {};
    console.log('[feishu-event] 收到事件 type=', header.event_type, 'event_type=', event?.type);

    // 卡片按钮点击事件：event_type === 'card.action.trigger'，
    // event 结构：{ action: { value: {...} }, context: { open_id, open_message_id }, operator: { open_id } }
    if (header.event_type === 'card.action.trigger' || event?.type === 'card.action.trigger') {
      const action = event.action || {};
      const value = action.value || {};
      const ctx = event.context || {};
      const operator = event.operator || {};

      if (value.action !== 'quick_record') {
        // 不是我们的按钮，原样 200
        return res.json({ code: 0, msg: 'ignored' });
      }

      const userId = Number(value.userId);
      const amount = Number(value.amount);
      const messageId = ctx.open_message_id || action.message_id;

      if (!Number.isInteger(userId) || !Number.isInteger(amount)) {
        return res.json({ code: 0, msg: 'bad params' });
      }

      // 异步处理：先 200 应答飞书（避免超时），再写库 + 更新卡片
      res.json({ code: 0, msg: 'accepted' });
      handleQuickRecord(userId, amount, messageId, operator.open_id).catch((e) => {
        console.error('[feishu-event] 处理 quick_record 失败:', e);
      });
      return;
    }

    // 其它事件原样 200
    return res.json({ code: 0, msg: 'ok' });
  }),
);

/** 写记录 + 更新原卡片为"已记录"版 */
async function handleQuickRecord(userId, amount, messageId, operatorOpenId) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    console.warn(`[feishu-event] 用户不存在 userId=${userId}`);
    return;
  }

  // 安全校验：如果卡片运营者 openId 跟用户绑定的不一致，拒绝（防止伪造）
  if (operatorOpenId && user.feishuOpenId && operatorOpenId !== user.feishuOpenId) {
    console.warn(
      `[feishu-event] open_id 不匹配 user=${user.feishuOpenId} operator=${operatorOpenId}`,
    );
    return;
  }

  if (!Number.isInteger(amount) || amount < 10 || amount > 3000) {
    console.warn(`[feishu-event] amount 非法: ${amount}`);
    return;
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

  // 更新原卡片
  if (!messageId) {
    console.warn('[feishu-event] 没有 messageId，跳过卡片更新');
    return;
  }

  const doneCard = buildDoneCard({
    nickname: user.nickname || user.username,
    drank,
    goal,
    percent,
    baseUrl: baseUrl(),
    justAdded: amount,
  });

  try {
    await updateMessage(messageId, doneCard);
    console.log(`[feishu-event] 已更新卡片 ${messageId}（+${amount}ml, ${drank}/${goal}ml）`);
  } catch (e) {
    console.error(`[feishu-event] 卡片更新失败 ${messageId}:`, e.message);
  }
}

function baseUrl() {
  return (process.env.APP_BASE_URL || 'http://localhost:3001').replace(/\/$/, '');
}

export default router;