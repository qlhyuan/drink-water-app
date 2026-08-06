<template>
  <van-popup
    v-model:show="show"
    round
    :style="{ width: '85%', maxWidth: '340px', background: 'transparent' }"
    close-on-click-overlay
    @closed="emit('closed')"
  >
    <div class="achievement">
      <!-- 顶部装饰圆 -->
      <div class="ring r1"></div>
      <div class="ring r2"></div>
      <div class="ring r3"></div>

      <!-- 主体 -->
      <div class="card">
        <div class="emoji">🎉</div>
        <div class="title">今日目标已达成！</div>
        <div class="subtitle">{{ nickname || '朋友' }}，干得漂亮</div>

        <div class="stat">
          <div class="stat-num">{{ drank }}<span class="unit">ml</span></div>
          <div class="stat-label">今日累计</div>
        </div>

        <div class="tip">多喝水，多健康，明天继续加油 💧</div>
        <button class="btn" @click="show = false">继续保持 ✨</button>
      </div>
    </div>
  </van-popup>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  modelValue: Boolean,
  nickname: { type: String, default: '' },
  drank: { type: Number, default: 0 },
  goal: { type: Number, default: 2000 },
});
const emit = defineEmits(['update:modelValue', 'closed']);

// 双向绑定：v-model
const show = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v),
});
</script>

<style scoped>
.achievement {
  position: relative;
  padding: 20px 0;
}

/* 装饰圆环 */
.ring {
  position: absolute;
  border-radius: 50%;
  pointer-events: none;
}
.r1 { width: 240px; height: 240px; top: -80px; left: 50%; transform: translateX(-50%); background: radial-gradient(circle, rgba(34, 197, 94, 0.18), transparent 70%); animation: pulse 2s ease-out infinite; }
.r2 { width: 180px; height: 180px; top: -40px; left: 50%; transform: translateX(-50%); background: radial-gradient(circle, rgba(250, 204, 21, 0.22), transparent 70%); animation: pulse 2.4s ease-out infinite 0.3s; }
.r3 { width: 120px; height: 120px; top: -10px; left: 50%; transform: translateX(-50%); background: radial-gradient(circle, rgba(59, 130, 246, 0.18), transparent 70%); animation: pulse 2.8s ease-out infinite 0.6s; }
@keyframes pulse {
  0% { opacity: 0.4; transform: translateX(-50%) scale(0.6); }
  100% { opacity: 0; transform: translateX(-50%) scale(1.6); }
}

.card {
  position: relative;
  background: white;
  border-radius: 18px;
  padding: 36px 24px 24px;
  text-align: center;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15);
}
.emoji {
  font-size: 64px;
  line-height: 1;
  animation: bounce 0.6s ease-out;
}
@keyframes bounce {
  0% { transform: scale(0.3) rotate(-10deg); opacity: 0; }
  50% { transform: scale(1.15) rotate(5deg); }
  100% { transform: scale(1) rotate(0); opacity: 1; }
}
.title {
  font-size: 20px; font-weight: 700;
  background: linear-gradient(135deg, #10b981, #059669);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  margin-top: 12px;
}
.subtitle { font-size: 13px; color: var(--text-secondary); margin-top: 6px; }

.stat {
  margin: 20px auto 16px;
  padding: 14px 0;
  background: linear-gradient(135deg, #ecfdf5, #d1fae5);
  border-radius: 12px;
  max-width: 200px;
}
.stat-num {
  font-size: 32px; font-weight: 700; color: #059669;
}
.stat-num .unit { font-size: 14px; margin-left: 2px; color: #10b981; font-weight: 500; }
.stat-label { font-size: 12px; color: #047857; margin-top: 4px; }

.tip {
  font-size: 12px; color: var(--text-tertiary);
  padding: 8px 12px; background: var(--bg);
  border-radius: 8px; margin-bottom: 16px;
}

.btn {
  width: 100%;
  padding: 12px;
  background: linear-gradient(135deg, #10b981, #059669);
  color: white; border: none; border-radius: 12px;
  font-size: 15px; font-weight: 600; cursor: pointer;
  box-shadow: 0 4px 14px rgba(16, 185, 129, 0.3);
  transition: all 0.15s;
}
.btn:active { transform: scale(0.98); box-shadow: 0 2px 8px rgba(16, 185, 129, 0.3); }
</style>