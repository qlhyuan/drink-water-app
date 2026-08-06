/**
 * 心跳 composable
 * - 仅在页面可见时每 30 秒发一次心跳
 * - 用于后端判定用户是否「在线」，决定达成激励走弹窗还是飞书
 */
import { ref, onMounted, onUnmounted } from 'vue';
import { heartbeatApi } from '../api';

const HEARTBEAT_INTERVAL = 30_000; // 30 秒

export function useHeartbeat() {
  const online = ref(true); // 前端视角：页面可见即视为「在线」
  let timer = null;

  async function ping() {
    try {
      await heartbeatApi.ping();
    } catch {
      // 网络异常不影响 UI
    }
  }

  function start() {
    if (timer) return;
    ping(); // 立即发一次
    timer = setInterval(ping, HEARTBEAT_INTERVAL);
  }

  function stop() {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  }

  function handleVisibility() {
    if (document.visibilityState === 'visible') {
      online.value = true;
      start();
    } else {
      online.value = false;
      stop();
    }
  }

  onMounted(() => {
    document.addEventListener('visibilitychange', handleVisibility);
    if (document.visibilityState === 'visible') start();
  });

  onUnmounted(() => {
    document.removeEventListener('visibilitychange', handleVisibility);
    stop();
  });

  return { online };
}