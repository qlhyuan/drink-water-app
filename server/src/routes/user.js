import { Router } from 'express';
import { z } from 'zod';
import prisma from '../prisma/client.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();
router.use(authMiddleware);

/** GET /api/user — 当前用户信息 */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    res.json(publicUser(req.user));
  }),
);

/** PUT /api/user — 更新资料 */
router.put(
  '/',
  asyncHandler(async (req, res) => {
    const data = z
      .object({
        nickname: z.string().max(32).optional(),
        avatar: z.string().url().max(255).optional(),
        weight: z.number().min(20).max(300).optional(),
        activity: z.enum(['sedentary', 'light', 'intense']).optional(),
        environment: z.enum(['ac', 'normal', 'outdoor']).optional(),
        goal: z.number().int().min(500).max(5000).optional(),
      })
      .parse(req.body);
    const user = await prisma.user.update({ where: { id: req.user.id }, data });
    res.json(publicUser(user));
  }),
);

/** POST /api/user/onboarding — 首次设置（体重/活动/环境/目标） */
router.post(
  '/onboarding',
  asyncHandler(async (req, res) => {
    const data = z
      .object({
        weight: z.number().min(20).max(300),
        activity: z.enum(['sedentary', 'light', 'intense']),
        environment: z.enum(['ac', 'normal', 'outdoor']),
      })
      .parse(req.body);
    const goal = recommendGoal(data);
    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: { ...data, goal },
    });
    res.json(publicUser(user));
  }),
);

function recommendGoal({ weight, activity, environment }) {
  // 基础：体重 × 35ml
  let goal = weight * 35;
  // 活动系数
  const activityFactor = { sedentary: 1.0, light: 1.1, intense: 1.25 }[activity] ?? 1;
  goal *= activityFactor;
  // 环境系数（户外/炎热补 200ml，空调房减 100ml）
  const envDelta = { ac: -100, normal: 0, outdoor: 200 }[environment] ?? 0;
  goal += envDelta;
  // 圆整到 50ml
  return Math.max(800, Math.round(goal / 50) * 50);
}

function publicUser(u) {
  return {
    id: u.id,
    username: u.username,
    nickname: u.nickname,
    avatar: u.avatar,
    weight: u.weight,
    activity: u.activity,
    environment: u.environment,
    goal: u.goal,
  };
}

export default router;