import { Router } from 'express';
import crypto from 'node:crypto';
import dayjs from 'dayjs';
import prisma from '../prisma/client.js';

const router = Router();

const SECRET = () => process.env.QUICK_RECORD_SECRET || process.env.JWT_SECRET || 'change-me-quick-record';

/**
 * 签名 token 格式：base64url(JSON({u, a, e})) + "." + hmac
 *   u: userId, a: amount(ml), e: expiresAt(unix ms)
 * 用法：飞书卡片按钮 URL = `${baseUrl}/api/quick-record?t=<token>`
 * 验证后立即写入 DrinkRecord 并返回一个成功提示 HTML 页（飞书内会内嵌渲染）。
 */
function signToken({ userId, amount, ttlMs = 10 * 60 * 1000 }) {
  const payload = { u: userId, a: amount, e: Date.now() + ttlMs };
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', SECRET()).update(body).digest('base64url');
  return `${body}.${sig}`;
}

function verifyToken(token) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return null;
  const [body, sig] = token.split('.');
  const expect = crypto.createHmac('sha256', SECRET()).update(body).digest('base64url');
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expect))) return null;
  let payload;
  try {
    payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
  if (!payload || Date.now() > payload.e) return null;
  return payload;
}

/** 生成三个按钮的签名直链 */
export function buildQuickRecordLinks(baseUrl, userId) {
  const cleanBase = (baseUrl || '').replace(/\/$/, '');
  return [100, 200, 500].map((amount) => ({
    amount,
    url: `${cleanBase}/api/quick-record?t=${signToken({ userId, amount })}`,
  }));
}

/** 飞书卡片按钮点击进入此接口：记录 + 返回 HTML 提示页 */
router.get('/', async (req, res) => {
  const t = req.query.t;
  const payload = verifyToken(t);
  if (!payload) {
    return res.status(400).send(htmlPage({
      emoji: '⚠️',
      title: '链接已失效',
      message: '该链接已过期或无效，请打开应用查看最新提醒。',
    }));
  }

  const { u: userId, a: amount } = payload;
  const amountNum = Number(amount);
  if (!Number.isInteger(amountNum) || amountNum < 10 || amountNum > 3000) {
    return res.status(400).send(htmlPage({
      emoji: '⚠️',
      title: '参数错误',
      message: '饮水量不合法（应在 10-3000ml）。',
    }));
  }

  try {
    const user = await prisma.user.findUnique({ where: { id: Number(userId) } });
    if (!user) {
      return res.status(404).send(htmlPage({
        emoji: '⚠️',
        title: '用户不存在',
        message: '该账号已不存在，请重新登录。',
      }));
    }

    const record = await prisma.drinkRecord.create({
      data: {
        userId: user.id,
        amount: amountNum,
        cupType: 'quick_feishu',
        cupEmoji: '💧',
      },
    });

    // 计算今日累计 + 进度
    const start = dayjs().startOf('day').toDate();
    const end = dayjs().endOf('day').toDate();
    const agg = await prisma.drinkRecord.aggregate({
      where: { userId: user.id, recordedAt: { gte: start, lte: end } },
      _sum: { amount: true },
    });
    const drank = agg._sum.amount || 0;
    const goal = user.goal || 2000;
    const percent = Math.min(100, Math.round((drank / goal) * 100));

    return res.send(htmlPage({
      emoji: '✅',
      title: `已记录 +${amountNum} ml`,
      message: `今日累计 ${drank} / ${goal} ml（${percent}%）\n继续保持哦～`,
      recordId: record.id,
    }));
  } catch (e) {
    console.error('[quick-record] 写入失败:', e);
    return res.status(500).send(htmlPage({
      emoji: '⚠️',
      title: '记录失败',
      message: '服务暂时不可用，请稍后再试。',
    }));
  }
});

function htmlPage({ emoji, title, message }) {
  const safeMsg = String(message).replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>');
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<title>${title}</title>
<style>
  body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;
    background:linear-gradient(135deg,#ecfdf5 0%,#fff 50%);font-family:-apple-system,BlinkMacSystemFont,"Helvetica Neue",sans-serif;color:#1f2937}
  .card{max-width:360px;background:#fff;border-radius:24px;padding:40px 32px;text-align:center;
    box-shadow:0 16rpx 40px rgba(16,185,129,0.18)}
  .emoji{font-size:72px;margin-bottom:16px}
  .title{font-size:24px;font-weight:700;color:#10b981;margin-bottom:12px}
  .msg{font-size:15px;line-height:1.6;color:#6b7280}
</style></head><body>
<div class="card">
  <div class="emoji">${emoji}</div>
  <div class="title">${title}</div>
  <div class="msg">${safeMsg}</div>
</div>
</body></html>`;
}

export default router;