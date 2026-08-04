import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import prisma from '../prisma/client.js';
import { asyncHandler, ApiError } from '../utils/asyncHandler.js';
import { signToken } from '../utils/jwt.js';

const router = Router();

const credSchema = z.object({
  username: z.string().min(3).max(32).regex(/^[a-zA-Z0-9_]+$/),
  password: z.string().min(6).max(64),
  nickname: z.string().max(32).optional(),
});

router.post(
  '/register',
  asyncHandler(async (req, res) => {
    const data = credSchema.parse(req.body);
    const exists = await prisma.user.findUnique({ where: { username: data.username } });
    if (exists) throw new ApiError(409, '用户名已被占用');

    const passwordHash = await bcrypt.hash(data.password, 10);
    const user = await prisma.user.create({
      data: {
        username: data.username,
        passwordHash,
        nickname: data.nickname || data.username,
      },
    });
    // 默认提醒设置
    await prisma.reminderSetting.create({ data: { userId: user.id } });

    const token = signToken({ userId: user.id });
    res.status(201).json({ token, user: publicUser(user) });
  }),
);

router.post(
  '/login',
  asyncHandler(async (req, res) => {
    const { username, password } = z
      .object({ username: z.string(), password: z.string() })
      .parse(req.body);
    const user = await prisma.user.findUnique({ where: { username } });
    if (!user) throw new ApiError(401, '用户名或密码错误');
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) throw new ApiError(401, '用户名或密码错误');

    const token = signToken({ userId: user.id });
    res.json({ token, user: publicUser(user) });
  }),
);

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