/**
 * 飞书喝水提醒 Worker
 * - 每 30 秒 tick 一次，扫描启用提醒且已绑定飞书的用户
 * - 在用户设置的提醒时刻（startTime 起，每 interval 分钟一个，至 endTime）
 *   推送一条飞书单聊消息卡片（含今日进度）
 * - 只在 FEISHU_APP_ID 配置后运行；未配置时跳过
 *
 * 说明：飞书对应用机器人主动推送没有微信那样的"24 小时交互窗口"限制，
 * 用户使用过应用（授权过）即可收到。为避免骚扰，仍尊重用户设置的提醒时段。
 */
import prisma from './prisma/client.js';
import {
  isFeishuEnabled,
  sendMessage,
  buildReminderCard,
} from './feishu/client.js';

const TICK_MS = 30_000;
// 记录今天已推送过的 (userId + HH:MM)，防止同分钟重复推送
const sentToday = new Set();
let lastDate = '';

export function startReminderWorker() {
  if (!isFeishuEnabled()) {
    console.log('[feishu-reminder] 未配置 FEISHU_APP_ID，提醒 Worker 未启动');
    return;
  }
  console.log('[feishu-reminder] 提醒 Worker 已启动（每 30s tick）');
  setInterval(tick, TICK_MS);
  tick().catch((e) => console.error('[feishu-reminder] 首次 tick 失败:', e.message));
}

async function tick() {
  const now = new Date();
  const dateKey = now.toISOString().slice(0, 10);
  if (dateKey !== lastDate) {
    sentToday.clear();
    lastDate = dateKey;
  }

  const settings = await prisma.reminderSetting.findMany({
    where: { enabled: true },
    include: { user: true },
  });

  for (const s of settings) {
    const { user } = s;
    if (!user.feishuOpenId) continue; // 未绑定飞书，无法推送

    // 使用用户存储的时区偏移计算其本地时间
    const hhmm = getUserLocalHHMM(now, s.timezone);
    if (!isReminderMoment(hhmm, s.startTime, s.endTime, s.interval)) continue;

    const key = `${user.id}:${dateKey}:${hhmm}`;
    if (sentToday.has(key)) continue;
    sentToday.add(key);

    const { drank, goal } = await todayProgress(user.id, user.goal || 2000, s.timezone);
    const percent = goal > 0 ? Math.round((drank / goal) * 100) : 0;
    const card = buildReminderCard({
      nickname: user.nickname || user.username,
      drank,
      goal,
      percent,
      baseUrl: baseUrl(),
      userId: user.id,
    });

    try {
      const sent = await sendMessage(user.feishuOpenId, 'interactive', card);
      console.log(
        `[feishu-reminder] 已推送 ${user.username} @ ${hhmm}（${drank}/${goal}ml）`,
        sent?.message_id ? `msg=${sent.message_id}` : '',
      );
    } catch (e) {
      console.error(`[feishu-reminder] 推送失败 ${user.username}:`, e.message);
    }
  }
}

/**
 * 根据用户存储的 UTC 偏移（如 "+08:00"）计算其本地 HH:MM
 * 解决 Docker 容器默认 UTC 与用户本地时间不一致的问题
 */
function getUserLocalHHMM(utcNow, tzOffset) {
  const sign = tzOffset.startsWith('-') ? -1 : 1;
  const [h, m] = tzOffset.slice(1).split(':').map(Number);
  const offsetMs = sign * (h * 60 + m) * 60 * 1000;
  const local = new Date(utcNow.getTime() + offsetMs);
  return local.toTimeString().slice(0, 5); // "HH:MM"
}

/** 判断当前 HH:MM 是否是用户的提醒时刻 */
function isReminderMoment(hhmm, startTime, endTime, intervalMin) {
  if (!startTime || !endTime || !intervalMin || intervalMin <= 0) return false;
  const [sh, sm] = startTime.split(':').map(Number);
  const [eh, em] = endTime.split(':').map(Number);
  const [ch, cm] = hhmm.split(':').map(Number);
  const startMin = sh * 60 + sm;
  const endMin = eh * 60 + em;
  const curMin = ch * 60 + cm;
  if (curMin < startMin || curMin > endMin) return false;
  return (curMin - startMin) % intervalMin === 0;
}

/** 今日累计喝水量（使用用户时区计算当日起点） */
async function todayProgress(userId, goal, tzOffset) {
  const now = new Date();
  const sign = tzOffset.startsWith('-') ? -1 : 1;
  const [h, m] = tzOffset.slice(1).split(':').map(Number);
  const offsetMs = sign * (h * 60 + m) * 60 * 1000;
  const userNow = new Date(now.getTime() + offsetMs);
  const userTodayStart = new Date(userNow);
  userTodayStart.setUTCHours(0, 0, 0, 0);
  // 转换回 UTC 时间戳用于数据库查询
  const start = new Date(userTodayStart.getTime() - offsetMs);
  const agg = await prisma.drinkRecord.aggregate({
    where: { userId, recordedAt: { gte: start } },
    _sum: { amount: true },
  });
  return { drank: agg._sum.amount || 0, goal };
}

function baseUrl() {
  return (process.env.APP_BASE_URL || 'http://localhost:3001').replace(/\/$/, '');
}
