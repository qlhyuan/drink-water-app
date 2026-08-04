import 'dotenv/config';
import bcrypt from 'bcryptjs';
import dayjs from 'dayjs';
import prisma from './client.js';

async function main() {
  const username = 'demo';
  const password = 'demo1234';
  const passwordHash = await bcrypt.hash(password, 10);

  const user = await prisma.user.upsert({
    where: { username },
    update: {},
    create: {
      username,
      passwordHash,
      nickname: '小水滴',
      weight: 65,
      activity: 'light',
      environment: 'normal',
      goal: 2200,
    },
  });
  await prisma.reminderSetting.upsert({
    where: { userId: user.id },
    update: {},
    create: { userId: user.id },
  });

  // 清掉旧记录后写今天的演示记录
  await prisma.drinkRecord.deleteMany({ where: { userId: user.id } });
  const today = dayjs();
  const samples = [
    { hour: 8, minute: 30, amount: 500, cup: '保温杯', emoji: '🧴' },
    { hour: 10, minute: 23, amount: 250, cup: '马克杯', emoji: '🥛' },
    { hour: 12, minute: 5, amount: 200, cup: '快速记录', emoji: '💧' },
    { hour: 14, minute: 32, amount: 250, cup: '马克杯', emoji: '🥛' },
    { hour: 16, minute: 10, amount: 500, cup: '瓶装水', emoji: '🍶' },
  ];
  for (const s of samples) {
    await prisma.drinkRecord.create({
      data: {
        userId: user.id,
        amount: s.amount,
        cupType: s.cup,
        cupEmoji: s.emoji,
        recordedAt: today.hour(s.hour).minute(s.minute).second(0).toDate(),
      },
    });
  }

  console.log(`[seed] user=${username} password=${password}`);
  console.log(`[seed] today ${samples.length} records inserted`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());