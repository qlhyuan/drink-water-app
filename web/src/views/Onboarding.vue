<template>
  <div class="onboarding">
    <div class="hero">
      <div class="logo">💧</div>
      <div class="title">告诉我们一些基本信息</div>
      <div class="subtitle">我们将据此智能推荐你的每日饮水目标</div>
    </div>

    <van-cell-group inset class="card">
      <div class="row">
        <div class="label">体重</div>
        <div class="value">{{ weight }} kg</div>
      </div>
      <van-slider v-model="weight" :min="30" :max="150" bar-height="6px" active-color="var(--brand)">
        <template #button><div class="bubble">{{ weight }}</div></template>
      </van-slider>
    </van-cell-group>

    <div class="card">
      <div class="label muted">活动水平</div>
      <div class="opt-grid">
        <div
          v-for="o in activities"
          :key="o.value"
          class="opt"
          :class="{ active: activity === o.value }"
          @click="activity = o.value"
        >
          <div class="emoji">{{ o.emoji }}</div>
          <div class="name">{{ o.name }}</div>
          <div class="meta">{{ o.meta }}</div>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="label muted">工作环境</div>
      <div class="opt-grid">
        <div
          v-for="o in environments"
          :key="o.value"
          class="opt"
          :class="{ active: environment === o.value }"
          @click="environment = o.value"
        >
          <div class="emoji">{{ o.emoji }}</div>
          <div class="name">{{ o.name }}</div>
        </div>
      </div>
    </div>

    <div class="result">
      <div class="result-label">为你推荐的每日饮水目标</div>
      <div class="result-value">{{ recommend }}<small>ml</small></div>
      <div class="result-tip">≈ {{ Math.round(recommend / 250) }} 杯 · 可随时调整</div>
    </div>

    <van-button block round type="primary" size="large" :loading="loading" @click="submit">
      开始记录 →
    </van-button>
    <van-button block plain hairline size="small" @click="$router.replace('/')" style="margin-top:8px;">
      稍后设置
    </van-button>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import { showToast } from 'vant';
import { userApi } from '../api';
import { useAuthStore } from '../stores/auth';

const auth = useAuthStore();
const router = useRouter();

const weight = ref(65);
const activity = ref('light');
const environment = ref('normal');
const loading = ref(false);

const activities = [
  { value: 'sedentary', emoji: '🪑', name: '久坐', meta: '办公室' },
  { value: 'light', emoji: '🚶', name: '轻度', meta: '偶尔运动' },
  { value: 'intense', emoji: '🏃', name: '高强度', meta: '每天运动' },
];
const environments = [
  { value: 'ac', emoji: '❄️', name: '空调房' },
  { value: 'normal', emoji: '🌤️', name: '常温' },
  { value: 'outdoor', emoji: '☀️', name: '户外' },
];

const recommend = computed(() => {
  let g = weight.value * 35;
  g *= { sedentary: 1, light: 1.1, intense: 1.25 }[activity.value] ?? 1;
  g += { ac: -100, normal: 0, outdoor: 200 }[environment.value] ?? 0;
  return Math.max(800, Math.round(g / 50) * 50);
});

async function submit() {
  loading.value = true;
  try {
    await userApi.onboarding({
      weight: weight.value,
      activity: activity.value,
      environment: environment.value,
    });
    await auth.refreshUser();
    showToast('设置完成');
    router.replace('/');
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
.onboarding { padding: 32px 16px 80px; background: linear-gradient(180deg, #ecfdf5, #fff 60%); min-height: 100vh; }
.hero { text-align: center; margin-bottom: 28px; }
.logo { font-size: 48px; }
.title { font-size: 18px; font-weight: 700; margin-top: 8px; }
.subtitle { font-size: 12px; color: var(--text-secondary); margin-top: 4px; }
.card { background: white; border-radius: 14px; padding: 16px; margin-bottom: 12px; box-shadow: var(--shadow); }
.row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; font-size: 13px; }
.row .value { font-weight: 700; color: var(--brand); }
.bubble { background: var(--brand); color: white; padding: 2px 8px; border-radius: 8px; font-size: 12px; }
.label { font-size: 13px; margin-bottom: 10px; }
.opt-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
.opt { background: white; border-radius: 12px; padding: 12px 8px; text-align: center; border: 2px solid transparent; }
.opt.active { border-color: var(--brand); background: var(--brand-light); }
.emoji { font-size: 22px; }
.name { font-size: 12px; font-weight: 600; margin-top: 4px; }
.meta { font-size: 10px; color: var(--text-secondary); }
.result { background: linear-gradient(135deg, var(--brand), var(--brand-dark)); border-radius: 16px; padding: 18px; color: white; text-align: center; margin: 18px 0; box-shadow: var(--shadow-brand); }
.result-label { font-size: 12px; opacity: 0.9; }
.result-value { font-size: 40px; font-weight: 700; margin: 4px 0; }
.result-value small { font-size: 16px; font-weight: 400; margin-left: 4px; }
.result-tip { font-size: 12px; opacity: 0.9; }
</style>