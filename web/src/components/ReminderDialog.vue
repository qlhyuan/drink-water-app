<template>
  <van-popup
    v-model:show="state.show"
    round
    :style="{ width: '85%', maxWidth: '340px' }"
    close-on-click-overlay
  >
    <div class="dialog">
      <div class="emoji">{{ cupInfo.emoji }}</div>
      <div class="title">该喝水啦</div>
      <div class="desc">距上次喝水已有一段时间，补充水分吧～</div>

      <div class="progress">
        <div class="progress-bar">
          <div class="progress-fill" :style="{ width: pct + '%' }" />
        </div>
        <div class="progress-text">今日 {{ state.drank }} / {{ state.goal }} ml</div>
      </div>

      <div class="actions">
        <van-button type="primary" block round :loading="recording" @click="drink">
          记录一杯水 +{{ cupInfo.amount }}ml
        </van-button>
        <van-button plain block round class="later" @click="state.show = false">
          稍后再说
        </van-button>
      </div>
    </div>
  </van-popup>
</template>

<script setup>
import { ref, computed } from 'vue';
import { showToast } from 'vant';
import { recordApi } from '../api';
import { reminderDialog } from '../utils/reminder';
import { useAuthStore } from '../stores/auth';

const auth = useAuthStore();
const state = reminderDialog;
const recording = ref(false);

// 内置默认杯型（与服务端 cups.js 保持一致）
const BUILTIN_CUPS = {
  d1: { name: '马克杯', amount: 250, emoji: '🥛' },
  d2: { name: '保温杯', amount: 500, emoji: '🧴' },
  d3: { name: '瓶装水', amount: 550, emoji: '🍶' },
  d4: { name: '大瓶装', amount: 1500, emoji: '🫙' },
};

const DEFAULT_CUP = { name: '默认杯', amount: 250, emoji: '💧' };

/** 根据用户设置的默认杯型 ID 解析出弹窗使用的容量与图标 */
const cupInfo = computed(() => {
  const id = auth.user?.defaultCupId;
  if (!id) return DEFAULT_CUP;
  // 内置杯型
  if (BUILTIN_CUPS[id]) return BUILTIN_CUPS[id];
  // 自定义杯型：尝试从已加载列表中找，否则降级到默认
  return DEFAULT_CUP;
});

const pct = computed(() =>
  Math.min(100, Math.round((state.drank / (state.goal || 2000)) * 100)),
);

/** 一键记录默认杯型容量 */
async function drink() {
  if (recording.value) return;
  recording.value = true;
  try {
    const payload = { amount: cupInfo.value.amount, cupType: cupInfo.value.name, cupEmoji: cupInfo.value.emoji };
    await recordApi.add(payload);
    state.drank += cupInfo.value.amount;
    showToast({ message: `已记录 +${cupInfo.value.amount}ml 🎉`, type: 'success' });
    if (state.drank >= state.goal) state.show = false; // 达成目标后自动关闭
  } catch {
    /* 失败提示由 http 拦截器统一处理 */
  } finally {
    recording.value = false;
  }
}
</script>

<style scoped>
.dialog { padding: 28px 24px 24px; text-align: center; }
.emoji { font-size: 56px; }
.title { font-size: 20px; font-weight: 700; margin-top: 10px; color: var(--brand-dark); }
.desc { font-size: 13px; color: var(--text-secondary); margin-top: 6px; }
.progress { margin: 18px 0 20px; }
.progress-bar {
  height: 8px; border-radius: 4px; background: var(--bg);
  overflow: hidden; border: 1px solid var(--border);
}
.progress-fill {
  height: 100%; border-radius: 4px;
  background: linear-gradient(90deg, #34d399, #10b981);
  transition: width 0.4s ease;
}
.progress-text { font-size: 12px; color: var(--text-secondary); margin-top: 8px; }
.actions { display: flex; flex-direction: column; gap: 10px; }
.later { border-color: var(--border); color: var(--text-secondary); }
</style>
