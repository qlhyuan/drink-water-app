import { Router } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import prisma from '../prisma/client.js';
import { asyncHandler, ApiError } from '../utils/asyncHandler.js';
import { signToken } from '../utils/jwt.js';
import { authMiddleware } from '../middleware/auth.js';
import {
  isFeishuEnabled,
  buildAuthorizeUrl,
  getUserByCode,
  randomSuffix,
} from '../feishu/client.js';

const router = Router();

/** 飞书登录配置：前端据此显示「飞书一键登录」按钮 */
router.get(
  '/config',
  asyncHandler(async (_req, res) => {
    if (!isFeishuEnabled()) {
      res.json({ enabled: false, authorizeUrl: '' });
      return;
    }
    // state 随机串，简单防 CSRF（登录流程里不强制校验，仅作追踪）
    const state = randomSuffix();
    res.json({ enabled: true, authorizeUrl: buildAuthorizeUrl(state) });
  }),
);

/**
 * 飞书 OAuth 免登录：
 * 1) 前端跳飞书授权 → 回调到 /feishu/callback?code=xxx
 * 2) 前端把 code POST 到这里
 * 3) 换 open_id → 已有用户直接登录；首次访问自动创建账号
 */
router.post(
  '/bind',
  asyncHandler(async (req, res) => {
    if (!isFeishuEnabled()) throw new ApiError(400, '飞书登录未启用（服务端未配置 FEISHU_APP_ID）');

    const { code } = z.object({ code: z.string().min(1) }).parse(req.body);
    let openId, name, avatar;
    try {
      ({ openId, name, avatar } = await getUserByCode(code));
    } catch (e) {
      // 飞书错误码 20003 = code 无效/已过期，映射为 4xx
      throw new ApiError(400, `飞书授权失败：${e.message || 'code 无效或已过期，请重试'}`);
    }

    let user = await prisma.user.findUnique({ where: { feishuOpenId: openId } });

    if (!user) {
      // 首次使用飞书 → 自动创建账号（随机密码，用户无法用密码登录，只能走飞书）
      const base = `feishu_${openId.slice(-8)}`;
      const username = await uniqueUsername(base);
      const passwordHash = await bcrypt.hash(randomSuffix() + Date.now(), 10);
      user = await prisma.user.create({
        data: {
          username,
          passwordHash,
          nickname: name || base,
          avatar,
          feishuOpenId: openId,
        },
      });
      // 默认提醒设置
      await prisma.reminderSetting.create({ data: { userId: user.id } });
    }

    const token = signToken({ userId: user.id });
    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        nickname: user.nickname,
        avatar: user.avatar,
        weight: user.weight,
        activity: user.activity,
        environment: user.environment,
        goal: user.goal,
      },
    });
  }),
);

/**
 * 把当前登录账号与飞书 open_id 绑定（合并身份）。
 * 用于：用户已注册账号，希望用飞书登录同一个账号。
 */
router.post(
  '/merge',
  authMiddleware,
  asyncHandler(async (req, res) => {
    if (!isFeishuEnabled()) throw new ApiError(400, '飞书登录未启用（服务端未配置 FEISHU_APP_ID）');

    const { code } = z.object({ code: z.string().min(1) }).parse(req.body);
    const { openId, name } = await getUserByCode(code);

    const existing = await prisma.user.findUnique({ where: { feishuOpenId: openId } });
    if (existing && existing.id !== req.user.id) {
      throw new ApiError(409, '该飞书账号已绑定其他用户');
    }

    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: { feishuOpenId: openId, nickname: req.user.nickname || name || undefined },
    });
    res.json({ ok: true, user: { id: user.id, nickname: user.nickname } });
  }),
);

async function uniqueUsername(base) {
  let candidate = base;
  let i = 1;
  while (await prisma.user.findUnique({ where: { username: candidate } })) {
    candidate = `${base}_${i++}`;
  }
  return candidate;
}

export default router;
