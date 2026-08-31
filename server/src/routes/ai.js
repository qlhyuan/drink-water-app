/**
 * /api/ai/* 路由
 *  - GET /api/ai/config    — 前端探测：是否启用、用的什么 provider/model
 *  - GET /api/ai/advice    — 个性化饮水建议（带缓存 + 降级文案）
 */
import { Router } from 'express';
import dayjs from 'dayjs';
import prisma from '../prisma/client.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { authMiddleware } from '../middleware/auth.js';
import { chat, isAIConfigured, getAIProviderInfo } from '../ai/client.js';
import { get, set } from '../ai/cache.js';
import {
  getAdviceSystem,
  getTimeSlot,
  TIME_SLOT_NAME,
  buildAdviceUser,
} from '../ai/prompts/advice.js';

const router = Router();
router.use(authMiddleware);

/** 兜底文案：AI 未配置或调用失败时使用 */
const FALLBACK_ADVICE = [
  '保持规律饮水，每小时小口喝一次。',
  '早起先喝一杯温水，唤醒身体。',
  '运动前后各补一杯水，效果更好。',
];

/** GET /api/ai/config — 用于前端决定是否展示 AI 卡片入口 */
router.get(
  '/config',
  asyncHandler(async (_req, res) => {
    const info = getAIProviderInfo();
    res.json({
      enabled: info.configured,
      provider: info.provider,
      model: info.model,
    });
  }),
);

/** GET /api/ai/advice?fresh=1 — 个性化饮水建议；同用户同一时段复用缓存 */
router.get(
  '/advice',
  asyncHandler(async (req, res) => {
    const forceFresh = req.query.fresh === '1' || req.query.fresh === 'true';
    const hour = dayjs().hour();
    const slot = getTimeSlot(hour);
    // 缓存 key 带上时段，避免早上缓存被晚上复用
    const cacheKey = `advice:${req.user.id}:${dayjs().format('YYYYMMDD')}:${slot}`;
    const TTL_MS = 6 * 60 * 60 * 1000; // 6 小时

    // 1. 命中缓存直接返回（仅在非强制刷新时）
    if (!forceFresh) {
      const cached = get(cacheKey);
      if (cached) {
        return res.json({ ...cached, cached: true, slot, slotName: TIME_SLOT_NAME[slot] });
      }
    }

    // 2. 未配置 → 直接返回兜底文案（不抛错，前端卡片仍可展示）
    if (!isAIConfigured()) {
      return res.json({
        enabled: false,
        advice: FALLBACK_ADVICE,
        source: 'fallback',
        reason: 'AI_API_KEY 未配置',
        slot,
        slotName: TIME_SLOT_NAME[slot],
      });
    }

    // 3. 拉取近 7 天记录 + 今日合计
    const since = dayjs().subtract(6, 'day').startOf('day').toDate();
    const [records, todayAgg] = await Promise.all([
      prisma.drinkRecord.findMany({
        where: { userId: req.user.id, recordedAt: { gte: since } },
        select: { amount: true, recordedAt: true },
        orderBy: { recordedAt: 'asc' },
      }),
      prisma.drinkRecord.aggregate({
        _sum: { amount: true },
        where: {
          userId: req.user.id,
          recordedAt: { gte: dayjs().startOf('day').toDate() },
        },
      }),
    ]);

    const todayTotal = todayAgg._sum.amount || 0;

    try {
      const text = await chat({
        system: getAdviceSystem(hour),
        user: buildAdviceUser({ user: req.user, todayTotal, records, hour }),
        temperature: 0.7,
        maxTokens: 400,
      });

      // 拆行：只去掉明显的编号前缀（如 "1."、"1、"- "），不要误删数据里的数字（如 "21 点"）
      const advice = text
        .split(/\r?\n/)
        .map((l) => l.replace(/^(\s*(?:\d+[.\u3001\u3002)]\s*|[-•·]\s+))/, '').trim())
        .filter(Boolean)
        .map((l) => l.slice(0, 40)) // 硬性截断，防止超长
        .slice(0, 3);

      const payload = {
        enabled: true,
        advice: advice.length ? advice : FALLBACK_ADVICE,
        source: 'ai',
        cached: false,
        slot,
        slotName: TIME_SLOT_NAME[slot],
      };
      set(cacheKey, payload, TTL_MS);
      res.json(payload);
    } catch (e) {
      console.error('[ai/advice] 调用失败:', e.message);
      res.json({
        enabled: false,
        advice: FALLBACK_ADVICE,
        source: 'fallback',
        reason: e.code || 'AI_ERROR',
        cached: false,
        slot,
        slotName: TIME_SLOT_NAME[slot],
      });
    }
  }),
);

export default router;