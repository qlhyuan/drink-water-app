import { Router } from 'express';
import dayjs from 'dayjs';
import prisma from '../prisma/client.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();
router.use(authMiddleware);

/** GET /api/stats/overview?days=7|30|90 — 每日合计，用于折线/热力图 */
router.get(
  '/overview',
  asyncHandler(async (req, res) => {
    const days = Math.min(365, Math.max(1, Number(req.query.days) || 7));
    const start = dayjs().subtract(days - 1, 'day').startOf('day').toDate();

    const records = await prisma.drinkRecord.findMany({
      where: { userId: req.user.id, recordedAt: { gte: start } },
      orderBy: { recordedAt: 'asc' },
      select: { amount: true, recordedAt: true },
    });

    // 按日期聚合
    const buckets = new Map();
    for (let i = 0; i < days; i++) {
      const key = dayjs().subtract(days - 1 - i, 'day').format('YYYY-MM-DD');
      buckets.set(key, 0);
    }
    for (const r of records) {
      const key = dayjs(r.recordedAt).format('YYYY-MM-DD');
      if (buckets.has(key)) buckets.set(key, buckets.get(key) + r.amount);
    }

    const series = Array.from(buckets.entries()).map(([date, amount]) => ({
      date,
      amount,
      goal: req.user.goal,
      reached: amount >= req.user.goal,
    }));

    const total = series.reduce((s, x) => s + x.amount, 0);
    const avg = Math.round(total / days);
    const reachedDays = series.filter((x) => x.reached).length;
    const streak = computeStreak(series);

    res.json({
      days,
      series,
      total,
      avg,
      goal: req.user.goal,
      reachedDays,
      streak,
    });
  }),
);

/** GET /api/stats/today — 今日 24 小时分布（用于饼图） */
router.get(
  '/today',
  asyncHandler(async (req, res) => {
    const start = dayjs().startOf('day').toDate();
    const records = await prisma.drinkRecord.findMany({
      where: { userId: req.user.id, recordedAt: { gte: start } },
      select: { amount: true, recordedAt: true },
    });
    const buckets = { 早: 0, 中: 0, 晚: 0, 夜: 0 };
    for (const r of records) {
      const h = dayjs(r.recordedAt).hour();
      const k = h < 6 ? '夜' : h < 11 ? '早' : h < 18 ? '中' : '晚';
      buckets[k] += r.amount;
    }
    const total = records.reduce((s, r) => s + r.amount, 0);
    res.json({ buckets, total });
  }),
);

function computeStreak(series) {
  let s = 0;
  for (let i = series.length - 1; i >= 0; i--) {
    if (series[i].reached) s++;
    else break;
  }
  return s;
}

export default router;