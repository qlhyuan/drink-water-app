import { Router } from 'express';
import { z } from 'zod';
import dayjs from 'dayjs';
import prisma from '../prisma/client.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { authMiddleware } from '../middleware/auth.js';
import {
  isFeishuEnabled,
  sendMessage,
  buildAchievementCard,
} from '../feishu/client.js';

const router = Router();
router.use(authMiddleware);

/** GET /api/records?date=YYYY-MM-DD — 某天所有记录 + 当日合计 */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const date = (req.query.date || dayjs().format('YYYY-MM-DD')).slice(0, 10);
    const start = dayjs(date).startOf('day').toDate();
    const end = dayjs(date).endOf('day').toDate();

    const records = await prisma.drinkRecord.findMany({
      where: { userId: req.user.id, recordedAt: { gte: start, lte: end } },
      orderBy: { recordedAt: 'desc' },
    });
    const total = records.reduce((s, r) => s + r.amount, 0);
    const goal = req.user.goal;
    res.json({
      date,
      records,
      total,
      goal,
      progress: goal ? Math.min(100, Math.round((total / goal) * 100)) : 0,
    });
  }),
);

/** POST /api/records — 新增一次记录 */
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const data = z
      .object({
        amount: z.number().int().min(10).max(3000),
        cupType: z.string().max(32).optional(),
        cupEmoji: z.string().max(8).optional(),
        recordedAt: z.string().datetime().optional(),
      })
      .parse(req.body);

    // 计算「今日」起点（使用用户时区）
    const settings = await prisma.reminderSetting.findUnique({ where: { userId: req.user.id } });
    const tz = settings?.timezone || '+08:00';
    const nowMs = Date.now();
    const sign = tz.startsWith('-') ? -1 : 1;
    const [hh, mm] = tz.slice(1).split(':').map(Number);
    const offsetMs = sign * (hh * 60 + mm) * 60 * 1000;
    const localNow = new Date(nowMs + offsetMs);
    const dayStart = new Date(
      Date.UTC(localNow.getUTCFullYear(), localNow.getUTCMonth(), localNow.getUTCDate(), 0, 0, 0) -
        offsetMs,
    );
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000 - 1);

    // 插入前：今日旧总量 + goal
    const beforeAgg = await prisma.drinkRecord.aggregate({
      _sum: { amount: true },
      where: { userId: req.user.id, recordedAt: { gte: dayStart, lte: dayEnd } },
    });
    const beforeTotal = beforeAgg._sum.amount || 0;
    const beforeAchieved = beforeTotal >= req.user.goal;

    // 插入记录
    const record = await prisma.drinkRecord.create({
      data: {
        userId: req.user.id,
        amount: data.amount,
        cupType: data.cupType,
        cupEmoji: data.cupEmoji,
        recordedAt: data.recordedAt ? new Date(data.recordedAt) : undefined,
      },
    });

    // 插入后：今日新总量
    const afterTotal = beforeTotal + data.amount;
    const afterAchieved = afterTotal >= req.user.goal;
    const justAchieved = !beforeAchieved && afterAchieved;
    const today = dayjs().format('YYYY-MM-DD');

    // 如果刚达成：更新去重字段 + 后台发飞书
    let achievementSent = false;
    if (justAchieved) {
      await prisma.user.update({
        where: { id: req.user.id },
        data: { lastAchievementDate: today },
      });
      // 异步发飞书（不影响接口响应）
      const feishuOpenId = req.user.feishuOpenId;
      if (feishuOpenId && isFeishuEnabled()) {
        try {
          const card = buildAchievementCard({
            nickname: req.user.nickname,
            drank: afterTotal,
            goal: req.user.goal,
            baseUrl: process.env.APP_BASE_URL || 'http://localhost:5173',
          });
          await sendMessage(feishuOpenId, 'interactive', card);
          achievementSent = true;
        } catch (e) {
          console.warn('[achievement] 飞书发送失败:', e.message);
        }
      }
    }

    res.status(201).json({
      ...record,
      progress: {
        drank: afterTotal,
        goal: req.user.goal,
        percent: Math.min(100, Math.round((afterTotal / req.user.goal) * 100)),
      },
      justAchieved,
      achievementSent,
    });
  }),
);

/** DELETE /api/records/:id */
router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const record = await prisma.drinkRecord.findFirst({
      where: { id, userId: req.user.id },
    });
    if (!record) return res.status(404).json({ error: '记录不存在' });
    await prisma.drinkRecord.delete({ where: { id } });
    res.json({ ok: true });
  }),
);

/** POST /api/records/:id/undo — 撤销最近一条（软删后重建更友好；这里直接删） */
router.post(
  '/undo',
  asyncHandler(async (req, res) => {
    const last = await prisma.drinkRecord.findFirst({
      where: { userId: req.user.id },
      orderBy: { recordedAt: 'desc' },
    });
    if (!last) return res.status(404).json({ error: '没有可撤销的记录' });
    await prisma.drinkRecord.delete({ where: { id: last.id } });
    res.json({ ok: true, removed: last });
  }),
);

export default router;