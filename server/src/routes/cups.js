import { Router } from 'express';
import { z } from 'zod';
import prisma from '../prisma/client.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();
router.use(authMiddleware);

/** GET /api/cups — 当前用户的自定义杯型 + 内置默认 */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const cups = await prisma.customCup.findMany({
      where: { userId: req.user.id },
      orderBy: { sort: 'asc' },
    });
    // 内置默认杯型
    const defaults = [
      { id: 'd1', name: '马克杯', capacity: 250, emoji: '🥛', builtin: true },
      { id: 'd2', name: '保温杯', capacity: 500, emoji: '🧴', builtin: true },
      { id: 'd3', name: '瓶装水', capacity: 550, emoji: '🍶', builtin: true },
      { id: 'd4', name: '大瓶装', capacity: 1500, emoji: '🫙', builtin: true },
    ];
    res.json({ defaults, customs: cups });
  }),
);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const data = z
      .object({
        name: z.string().min(1).max(16),
        capacity: z.number().int().min(50).max(3000),
        emoji: z.string().max(8).optional(),
      })
      .parse(req.body);
    const cup = await prisma.customCup.create({
      data: {
        userId: req.user.id,
        name: data.name,
        capacity: data.capacity,
        emoji: data.emoji || '🥤',
      },
    });
    res.status(201).json(cup);
  }),
);

router.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const cup = await prisma.customCup.findFirst({ where: { id, userId: req.user.id } });
    if (!cup) return res.status(404).json({ error: '杯型不存在' });
    const data = z
      .object({
        name: z.string().min(1).max(16),
        capacity: z.number().int().min(50).max(3000),
        emoji: z.string().max(8).optional(),
      })
      .parse(req.body);
    const updated = await prisma.customCup.update({
      where: { id },
      data: { name: data.name, capacity: data.capacity, emoji: data.emoji || cup.emoji },
    });
    res.json(updated);
  }),
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const cup = await prisma.customCup.findFirst({ where: { id, userId: req.user.id } });
    if (!cup) return res.status(404).json({ error: '杯型不存在' });
    await prisma.customCup.delete({ where: { id } });
    res.json({ ok: true });
  }),
);

export default router;