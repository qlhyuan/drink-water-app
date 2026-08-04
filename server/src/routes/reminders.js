import { Router } from 'express';
import { z } from 'zod';
import prisma from '../prisma/client.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();
router.use(authMiddleware);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    let setting = await prisma.reminderSetting.findUnique({ where: { userId: req.user.id } });
    if (!setting) setting = await prisma.reminderSetting.create({ data: { userId: req.user.id } });
    res.json(setting);
  }),
);

router.put(
  '/',
  asyncHandler(async (req, res) => {
    const data = z
      .object({
        enabled: z.boolean().optional(),
        interval: z.number().int().min(15).max(240).optional(),
        startTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
        endTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
        vibrate: z.boolean().optional(),
        dnd: z.boolean().optional(),
        inApp: z.boolean().optional(),
        browser: z.boolean().optional(),
        sound: z.boolean().optional(),
        smartMode: z.boolean().optional(),
      })
      .parse(req.body);
    const setting = await prisma.reminderSetting.upsert({
      where: { userId: req.user.id },
      update: data,
      create: { userId: req.user.id, ...data },
    });
    res.json(setting);
  }),
);

export default router;