/**
 * 全局提醒调度器
 * 在提醒时段（startTime ~ endTime）内按间隔（interval）触发提醒：
 *  - inApp：应用内顶部通知条
 *  - browser：浏览器系统通知（需授权）
 *  - sound：水滴提示音（Web Audio，需用户交互后生效）
 *  - vibrate：设备震动
 * 智能模式（smartMode）：距上次喝水不足一个间隔时跳过，避免打扰。
 */
import { reactive } from 'vue';
import dayjs from 'dayjs';
import { reminderApi, recordApi } from '../api';

let settings = null; // 最近一次拉取的提醒设置
let timer = null; // tick 定时器
let audioCtx = null; // 水滴声 AudioContext（懒初始化）
let running = false;

const TICK_MS = 30 * 1000; // 每 30s 检查一次
const LAST_FIRED_KEY = 'drink_last_fired_at'; // 上次提醒时间（localStorage，刷新页面不重置节奏）
const DND_RANGE = { start: '22:00', end: '08:00' }; // 免打扰时段：夜间静音

/** 弹框提醒的响应式状态，由 ReminderDialog 组件消费 */
export const reminderDialog = reactive({ show: false, drank: 0, goal: 2000 });

/** 解析 HH:mm → 当日分钟数 */
function toMinutes(hhmm) {
  const [h, m] = String(hhmm || '00:00').split(':').map(Number);
  return h * 60 + (m || 0);
}

/** 当前是否处于 [start, end) 时段内（支持跨天，如 22:00-08:00） */
function inTimeRange(now, start, end) {
  const cur = now.getHours() * 60 + now.getMinutes();
  const s = toMinutes(start);
  const e = toMinutes(end);
  if (s === e) return true; // 起始相同视为全天
  return s < e ? cur >= s && cur < e : cur >= s || cur < e;
}

/** 用户首次交互时初始化音频上下文（浏览器自动播放策略要求） */
function ensureAudio() {
  try {
    if (!audioCtx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) audioCtx = new AC();
    }
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
  } catch {
    /* 忽略 */
  }
}
if (typeof window !== 'undefined') {
  window.addEventListener('pointerdown', ensureAudio, { once: true });
}

/** 播放水滴声（两声短促下滑音） */
function playDropSound() {
  if (!audioCtx) return;
  const t0 = audioCtx.currentTime;
  [
    [880, 0, 0.09],
    [1320, 0.11, 0.12],
  ].forEach(([freq, at, dur]) => {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, t0 + at);
    osc.frequency.exponentialRampToValueAtTime(freq * 1.5, t0 + at + dur);
    gain.gain.setValueAtTime(0.0001, t0 + at);
    gain.gain.exponentialRampToValueAtTime(0.3, t0 + at + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + at + dur);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start(t0 + at);
    osc.stop(t0 + at + dur + 0.05);
  });
}

/** 触发一次提醒：打开应用内弹框 + 系统通知（dnd 免打扰时段内自动静音） */
async function fire(nowTs) {
  const s = settings;
  const quiet = s.dnd && inTimeRange(new Date(), DND_RANGE.start, DND_RANGE.end);

  if (!quiet && s.sound) playDropSound();
  if (!quiet && s.vibrate) navigator.vibrate?.(200);

  if (s.inApp) {
    // 拉取今日进度后打开弹框
    try {
      const { total, goal } = await recordApi.list(dayjs().format('YYYY-MM-DD'));
      reminderDialog.drank = total;
      reminderDialog.goal = goal;
      reminderDialog.show = true;
    } catch {
      reminderDialog.drank = 0;
      reminderDialog.goal = s.goal || 2000;
      reminderDialog.show = true;
    }
  }

  if (s.browser && 'Notification' in window && Notification.permission === 'granted') {
    try {
      const n = new Notification('💧 该喝水啦', {
        body: `已到喝水时间（${s.startTime}-${s.endTime}），喝一杯水吧！`,
        icon: '/favicon.svg',
        tag: 'drink-reminder',
      });
      n.onclick = () => {
        window.focus();
        location.href = '/';
        n.close();
      };
    } catch {
      /* 忽略 */
    }
  }

  localStorage.setItem(LAST_FIRED_KEY, String(nowTs));
}

/** 智能模式：距上次喝水不足一个间隔则跳过（刚喝过就不打扰） */
async function recentlyDrank(intervalMs) {
  try {
    const { records } = await recordApi.list(dayjs().format('YYYY-MM-DD'));
    const last = records?.[0];
    if (!last || !last.recordedAt) return false;
    return Date.now() - new Date(last.recordedAt).getTime() < intervalMs;
  } catch {
    return false;
  }
}

async function tick() {
  if (!running || !settings || !settings.enabled) return;
  const now = new Date();
  if (!inTimeRange(now, settings.startTime, settings.endTime)) return;

  const intervalMs = (settings.interval || 60) * 60 * 1000;
  const lastFired = Number(localStorage.getItem(LAST_FIRED_KEY)) || 0;
  if (now.getTime() - lastFired < intervalMs) return;

  if (settings.smartMode && (await recentlyDrank(intervalMs))) return;

  await fire(now.getTime());
}

/** 登录后调用：拉取提醒设置并开始调度 */
export async function startReminder() {
  if (running) return;
  running = true;
  try {
    settings = await reminderApi.get();
  } catch {
    settings = null;
  }
  if (timer) clearInterval(timer);
  timer = setInterval(tick, TICK_MS);
  tick();
}

/** 登出时调用：停止调度 */
export function stopReminder() {
  running = false;
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
  settings = null;
}

/** 提醒设置保存后调用：立即采用新配置 */
export async function refreshReminder() {
  if (!running) return;
  try {
    settings = await reminderApi.get();
  } catch {
    /* 忽略 */
  }
  tick();
}
