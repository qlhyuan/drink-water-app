import 'dotenv/config';
import bcrypt from 'bcryptjs';
import prisma from './prisma/client.js';

/**
 * 启动时根据环境变量自动创建管理员账号：
 *   ADMIN_USERNAME 用户名（必填才触发）
 *   ADMIN_PASSWORD 密码（必填才触发）
 *   ADMIN_NICKNAME 昵称（可选，默认同用户名）
 *
 * 仅在账号不存在时创建，绝不覆盖已有账号的密码。
 */
export async function bootstrapAdmin() {
  const username = process.env.ADMIN_USERNAME?.trim();
  const password = process.env.ADMIN_PASSWORD;

  if (!username || !password) {
    console.log('[bootstrap] 未设置 ADMIN_USERNAME / ADMIN_PASSWORD，跳过管理员创建');
    return null;
  }

  const exists = await prisma.user.findUnique({ where: { username } });
  if (exists) {
    console.log(`[bootstrap] 管理员账号 ${username} 已存在，跳过（不会覆盖已有密码）`);
    return exists;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: {
      username,
      passwordHash,
      nickname: process.env.ADMIN_NICKNAME?.trim() || username,
    },
  });
  await prisma.reminderSetting.upsert({
    where: { userId: user.id },
    update: {},
    create: { userId: user.id },
  });

  console.log(`[bootstrap] 已从环境变量创建管理员账号：${username}`);
  return user;
}
