import { Router } from 'express';
import { z } from 'zod';
import dayjs from 'dayjs';
import prisma from '../prisma/client.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { authMiddleware } from '../middleware/auth.js';

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

    const record = await prisma.drinkRecord.create({
      data: {
        userId: req.user.id,
        amount: data.amount,
        cupType: data.cupType,
        cupEmoji: data.cupEmoji,
        recordedAt: data.recordedAt ? new Date(data.recordedAt) : undefined,
      },
    });
    res.status(201).json(record);
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