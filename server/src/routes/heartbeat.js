/**
 * 心跳路由：前端定时调用，更新 lastSeenAt
 * 用于「在线/离线」判定（替代 WebSocket，简单可靠）
 */
import { Router } from 'express';
import prisma from '../prisma/client.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();
router.use(authMiddleware);

/** POST /api/heartbeat — 更新 lastSeenAt，返回当前在线状态 */
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const now = new Date();
    await prisma.user.update({
      where: { id: req.user.id },
      data: { lastSeenAt: now },
    });
    res.json({ ok: true, lastSeenAt: now.toISOString() });
  }),
);

export default router;