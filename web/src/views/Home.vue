<template>
  <div class="home">
    <header class="page-header weather-stage" :class="weatherStageClass">
      <div class="page-header-inner">
        <div class="header-text">
          <div class="status-line">
            <span>{{ statusLine }}</span>
            <button
              class="locate-btn"
              :class="{ locating: weatherState === 'locating' }"
              :disabled="weatherState === 'locating'"
              @click="onLocate"
              :title="locateTitle"
            >
              <van-icon :name="weatherState === 'locating' ? 'loading' : 'location-o'" class="locate-icon" />
              <span>{{ locateBtnText }}</span>
            </button>
          </div>
          <div class="title">{{ subtitle }}</div>
        </div>
      </div>
      <WeatherIcon
        v-if="meteoconSlug"
        :slug="meteoconSlug"
        :size="72"
        :color="iconColor"
        class="weather-anim"
      />
    </header>

    <div class="progress-card card">
      <ProgressRing :total="store.today.total" :goal="store.today.goal" />
      <div class="info">
        <div class="remain">还差 {{ store.remaining }}ml</div>
        <div class="encourage">{{ encourage }}</div>
        <div class="streak">🔥 连续 {{ store.stats.streak || 0 }} 天</div>
      </div>
    </div>

    <!-- AI 个性化小贴士 -->
    <section class="ai-card card">
      <div class="ai-head">
        <div class="ai-title">
          <span class="ai-icon">💡</span>
          <span>AI 小贴士</span>
          <span v-if="adviceState.source === 'fallback'" class="ai-badge">推荐</span>
          <span v-else-if="adviceState.source === 'ai'" class="ai-badge ai-badge-live">个性化</span>
        </div>
        <button class="ai-refresh" :disabled="adviceState.loading" @click="loadAdvice(true)">
          <van-icon :name="adviceState.loading ? 'loading' : 'replay'" class="ai-refresh-icon" />
          <span>{{ adviceState.loading ? '生成中…' : '换一批' }}</span>
        </button>
      </div>
      <ul v-if="!adviceState.loading && adviceState.advice.length" class="ai-list">
        <li v-for="(tip, i) in adviceState.advice" :key="i">{{ tip }}</li>
      </ul>
      <div v-else-if="adviceState.loading" class="ai-loading">
        <div class="skeleton"></div>
        <div class="skeleton"></div>
        <div class="skeleton short"></div>
      </div>
      <div v-else class="ai-empty">暂无建议</div>
    </section>

    <section class="block">
      <div class="section-title">快速记录</div>
      <div class="quick-grid">
        <div class="quick" @click="quickAdd(100)">
          <div class="drops">💧</div><div class="v">100</div><div class="u">ml</div>
        </div>
        <div class="quick" @click="quickAdd(200)">
          <div class="drops">💧💧</div><div class="v">200</div><div class="u">ml</div>
        </div>
        <div class="quick highlight" @click="quickAdd(500)">
          <div class="drops">💧💧💧</div><div class="v">500</div><div class="u">ml</div>
        </div>
      </div>
    </section>

    <section class="block">
      <div class="section-title-row">
        <div class="section-title">常用杯型</div>
        <div class="link" @click="showSheet = true">+ 自定义</div>
      </div>
      <div class="cup-grid">
        <div v-for="c in cups" :key="c.id" class="cup" @click="quickAdd(c.capacity, c.name, c.emoji)">
          <div class="emoji">{{ c.emoji }}</div>
          <div class="name">{{ c.name }}</div>
          <div class="cap">{{ c.capacity }}ml</div>
        </div>
      </div>
    </section>

    <section class="block">
      <div class="section-title-row">
        <div class="section-title">今日记录 ({{ store.today.records.length }})</div>
        <div v-if="store.today.records.length" class="link" @click="undo">↶ 撤销</div>
      </div>
      <div class="records card">
        <div v-if="!store.today.records.length" class="empty">
          <div class="empty-emoji">💧</div>
          <div>还没有记录，点击上方按钮开始吧</div>
        </div>
        <div v-for="r in store.today.records" :key="r.id" class="record-item">
          <span class="dot"></span>
          <span class="rname">{{ r.cupEmoji }} {{ r.cupType || '快速记录' }}</span>
          <span class="ramount">{{ r.amount }}ml</span>
          <span class="rtime">{{ formatTime(r.recordedAt) }}</span>
          <van-icon name="cross" class="rdel" @click="remove(r.id)" />
        </div>
      </div>
    </section>

    <RecordSheet v-model:show="showSheet" :default-amount="250" @submit="onSubmit" />

    <!-- 今日目标达成弹窗 -->
    <AchievementDialog
      v-model="showAchievement"
      :nickname="auth.user?.nickname || auth.user?.username || ''"
      :drank="store.today.total"
      :goal="store.today.goal"
    />
  </div>
</template>

<script setup>
import { onMounted, ref, reactive, computed } from 'vue';
import dayjs from 'dayjs';
import { showToast } from 'vant';
import { cupApi, aiApi } from '../api';
import { useRecordStore } from '../stores/record';
import { useAuthStore } from '../stores/auth';
import { useHeartbeat } from '../composables/useHeartbeat';
import { useWeather } from '../composables/useWeather';
import ProgressRing from '../components/ProgressRing.vue';
import RecordSheet from '../components/RecordSheet.vue';
import WeatherIcon from '../components/WeatherIcon.vue';
import AchievementDialog from '../components/AchievementDialog.vue';

const store = useRecordStore();
const auth = useAuthStore();
const showSheet = ref(false);
const showAchievement = ref(false);
const cups = ref([]);

// AI 小贴士状态
const adviceState = reactive({
  advice: [],
  source: '', // 'ai' | 'fallback'
  loading: false,
});

async function loadAdvice(forceFresh = false) {
  adviceState.loading = true;
  try {
    const res = await aiApi.advice(forceFresh);
    adviceState.advice = res?.advice || [];
    adviceState.source = res?.source || 'fallback';
  } catch (e) {
    // http 拦截器已提示；本地兜底
    adviceState.advice = [
      '保持规律饮水，每小时小口喝一次。',
      '早起先喝一杯温水，唤醒身体。',
      '运动前后各补一杯水，效果更好。',
    ];
    adviceState.source = 'fallback';
  } finally {
    adviceState.loading = false;
  }
}

// 启动心跳（仅在页面可见时）
useHeartbeat();

// 获取天气数据：默认按本地存储的城市，可手动切换城市，调用 locate() 浏览器定位
const { weather, state: weatherState, displayCity, changeCity, locate } = useWeather();

const locateTitle = computed(() => {
  switch (weatherState.value) {
    case 'locating': return '正在获取位置…';
    case 'denied': return '定位权限被拒绝';
    case 'unsupported': return '浏览器不支持定位';
    case 'failed': return '定位失败，点击重试';
    default: return `使用当前坐标实时获取天气（当前：${displayCity.value}）`;
  }
});

// 定位按钮文字：默认显示当前城市名（如“济南”），定位中变“定位中…”
const locateBtnText = computed(() => {
  if (weatherState.value === 'locating') return '定位中…';
  return displayCity.value || '定位';
});

async function onLocate() {
  try {
    await locate();
    showToast('已根据当前位置刷新天气');
  } catch (e) {
    if (weatherState.value === 'denied') {
      showToast('定位权限被拒绝，请在浏览器中开启');
    } else if (weatherState.value === 'unsupported') {
      showToast('浏览器不支持定位');
    } else {
      showToast('定位失败，请稍后重试');
    }
  }
}

const encourage = computed(() => {
  const p = store.today.progress;
  if (p >= 100) return '🎉 今日目标完成！';
  if (p >= 70) return '再坚持一下 💪';
  if (p >= 40) return '继续加油 🚀';
  return '开始喝水吧 ✨';
});

// 根据当前小时动态生成问候语
const greeting = computed(() => {
  const h = dayjs().hour();
  if (h < 5) return '夜深了';
  if (h < 11) return '早上好';
  if (h < 14) return '中午好';
  if (h < 18) return '下午好';
  return '晚上好';
});

// 根据当前小时动态生成副标题
const subtitle = computed(() => {
  const h = dayjs().hour();
  if (h < 5) return '夜深了，记得早点休息';
  if (h < 11) return '晨起第一杯，开启活力一天';
  if (h < 14) return '午后补水时间到';
  if (h < 18) return '下午茶时光，别忘了喝水';
  return '睡前别喝太多哦';
});

// 顶部一句话状态行：「晚上好，今日天气晴☀️，气温25度」
//  - 去掉“今日XX”这些城市名信息（城市名迁移到定位按钮）
//  - 新增“气温xx度”（后端 weather 接口返回 temperature 字段）
const statusLine = computed(() => {
  const greet = `${greeting.value}，`;
  if (!weather.value) return greet + '记得多喝水';
  const desc = weather.value.description || '';
  const icon = weather.value.icon || '';
  const temp = weather.value.temperature;
  const tempStr = typeof temp === 'number' ? `，气温${temp}度` : '';
  return `${greet}今日天气${desc}${icon}${tempStr}`;
});

// 根据天气 icon 判断背景色场景（key 与 CSS 类名一致）
const weatherStageClass = computed(() => {
  if (!weather.value) return '';
  const icon = weather.value.icon || '';
  if (icon.includes('☀️')) return 'sunny';
  if (icon.includes('🌤️') || icon.includes('⛅')) return 'cloudy';
  if (icon.includes('☁️')) return 'overcast';
  if (icon.includes('🌧️') || icon.includes('🌦️')) return 'rainy';
  if (icon.includes('🌨️') || icon.includes('❄️')) return 'snowy';
  if (icon.includes('⛈️')) return 'stormy';
  if (icon.includes('🌫️')) return 'foggy';
  return '';
});

// 后端 WMO 中文描述 → Meteocons slug（参考 server/src/routes/weather.js 的 WEATHER_CODE_MAP）
const DESC_TO_METEO = {
  晴: 'clear-day',
  晴间多云: 'partly-cloudy-day',
  多云: 'partly-cloudy-day',
  阴: 'cloudy',
  雾: 'fog',
  雾凇: 'fog',
  毛毛雨: 'drizzle',
  冻毛毛雨: 'sleet',
  小雨: 'rain',
  中雨: 'rain',
  大雨: 'rain',
  冻雨: 'sleet',
  强冻雨: 'sleet',
  小雪: 'snow',
  中雪: 'snow',
  大雪: 'snow',
  雪粒: 'snow',
  阵雨: 'rain',
  强阵雨: 'rain',
  极强阵雨: 'rain',
  阵雪: 'snow',
  强阵雪: 'snow',
  雷雨: 'thunderstorms',
  雷雨伴有冰雹: 'sleet',
  强雷雨伴有冰雹: 'sleet',
};

const meteoconSlug = computed(() => {
  if (!weather.value) return 'clear-day';
  const desc = weather.value.description || '';
  const base = DESC_TO_METEO[desc] || 'clear-day';
  // 夜晚 18:00-次日 06:00 显示月夜版晴/多云
  const h = new Date().getHours();
  const isNight = h < 6 || h >= 18;
  if (isNight && base === 'clear-day') return 'clear-night';
  if (isNight && base === 'partly-cloudy-day') return 'partly-cloudy-night';
  return base;
});

// 图标颜色：根据当前小时 + 天气类型返回合适的色调
const iconColor = computed(() => {
  if (!weather.value) return '#64748b';
  const h = new Date().getHours();
  const isNight = h < 6 || h >= 18;
  const slug = meteoconSlug.value;

  // 夜晚：月亮用淡黄"月光色"，其他天气用深蓝（夜空感）
  if (isNight) {
    if (slug === 'clear-night' || slug === 'partly-cloudy-night') {
      return '#fcd34d'; // 淡黄月光
    }
    if (slug === 'thunderstorms' || slug === 'rain' || slug === 'drizzle') {
      return '#1e40af'; // 雨夜深蓝
    }
    return '#1e3a8a'; // 其他夜晚深蓝紫
  }
  // 白天按天气类型给不同色调
  if (slug === 'clear-day') return '#f59e0b';       // 暖橙（太阳）
  if (slug === 'partly-cloudy-day') return '#facc15'; // 暖黄
  if (slug === 'cloudy') return '#64748b';           // 灰蓝
  if (slug === 'rain' || slug === 'drizzle') return '#0ea5e9'; // 天蓝
  if (slug === 'thunderstorms') return '#0369a1';    // 深蓝
  if (slug === 'snow' || slug === 'sleet') return '#38bdf8'; // 浅冰蓝
  if (slug === 'fog' || slug === 'mist' || slug === 'haze') return '#94a3b8'; // 雾灰
  return '#64748b';
});

function formatTime(t) { return dayjs(t).format('HH:mm'); }

async function quickAdd(amount, name, emoji) {
  const res = await store.addRecord({
    amount,
    cupType: name || '快速记录',
    cupEmoji: emoji || '💧',
  });
  showToast({ message: `已记录 ${amount}ml`, duration: 1200 });
  // 后端返回 justAchieved = true 表示今日刚刚首次达成
  if (res?.justAchieved) {
    setTimeout(() => (showAchievement.value = true), 600);
  }
}

async function onSubmit({ amount, cupType, cupEmoji }) {
  const res = await store.addRecord({ amount, cupType, cupEmoji });
  showSheet.value = false;
  showToast({ message: `已记录 ${amount}ml`, duration: 1200 });
  if (res?.justAchieved) {
    setTimeout(() => (showAchievement.value = true), 600);
  }
}

async function remove(id) {
  await store.removeRecord(id);
  showToast('已删除');
}

async function undo() {
  try {
    await store.undo();
    showToast('已撤销');
  } catch (e) { /* noop */ }
}

onMounted(async () => {
  await Promise.all([
    store.fetchToday(),
    store.fetchStats(7),
    (async () => {
      const { defaults, customs } = await cupApi.list();
      cups.value = [...defaults, ...customs];
    })(),
    loadAdvice(false),
  ]);
});
</script>

<style scoped>
.home { padding: 16px 16px 32px; max-width: 720px; margin: 0 auto; }
.page-header {
  display: flex; justify-content: space-between; align-items: center;
  padding: 8px 0 16px;
  position: relative;
}
.weather-stage {
  position: relative;
  padding: 16px 0 0;
  margin: 0 -16px 16px;
  border-radius: 16px;
  overflow: visible;
  transition: background 0.6s ease;
}
.page-header-inner {
  position: relative; z-index: 2;
  padding: 0 16px;
}
.header-text { padding-right: 96px; }

/* 天气动画图标：绝对定位，与副标题文字底部平齐 */
.weather-anim {
  position: absolute;
  bottom: -10px;
  right: 8px;
  z-index: 3;
  filter: drop-shadow(0 4px 12px rgba(0, 0, 0, 0.08));
  pointer-events: none;
}

/* 天气背景色：保留空类名占位，后续如需开启再启用 */

.status-line {
  font-size: 13px; color: #4b5563;
  font-weight: 500;
  display: flex; align-items: center; gap: 6px;
  flex-wrap: wrap;
}
/* 城市名按钮：包裹状态行后面点击可重新定位 */
.locate-btn {
  display: inline-flex; align-items: center; gap: 3px;
  padding: 1px 8px;
  font-size: 12px;
  background: rgba(255, 255, 255, 0.55);
  border: 1px solid rgba(0, 0, 0, 0.05);
  border-radius: 999px;
  color: #4b5563;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s, color 0.2s;
}
.locate-icon {
  font-size: 13px;
  line-height: 1;
  display: inline-flex;
}
.locate-btn:hover:not(:disabled) {
  background: rgba(0, 0, 0, 0.05);
  color: #1f2937;
}
.locate-btn:disabled,
.locate-btn.locating {
  cursor: wait;
  opacity: 0.7;
}
.title { font-size: 20px; font-weight: 700; margin-top: 4px; }
.bell {
  width: 36px; height: 36px; background: white; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  box-shadow: var(--shadow); text-decoration: none;
}
.progress-card {
  display: flex; align-items: center;
  padding: 20px 16px; margin-bottom: 20px; position: relative; overflow: hidden;
}
.progress-card::before {
  content: ''; position: absolute; top: -40px; right: -40px;
  width: 120px; height: 120px; background: var(--brand-light);
  border-radius: 50%; opacity: 0.5;
}
.info { flex: 1; margin-left: 16px; position: relative; z-index: 1; }
.remain { font-size: 12px; color: var(--text-secondary); }
.encourage { font-size: 16px; font-weight: 600; margin: 4px 0 8px; }
.streak { display: inline-block; background: #fef3c7; color: #92400e; font-size: 11px; padding: 4px 8px; border-radius: 999px; }

.block { margin-bottom: 20px; }
.ai-card {
  padding: 16px 16px 14px;
  margin-bottom: 20px;
  background: linear-gradient(135deg, #fff7ed 0%, #fef3c7 100%);
  border: 1px solid #fde68a;
}
.ai-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
.ai-title { font-size: 14px; font-weight: 600; display: flex; align-items: center; gap: 6px; }
.ai-icon { font-size: 16px; }
.ai-badge {
  font-size: 10px; padding: 2px 6px; border-radius: 999px;
  background: #e5e7eb; color: #4b5563; font-weight: 500;
}
.ai-badge-live { background: #d1fae5; color: #065f46; }
.ai-refresh {
  display: inline-flex; align-items: center; gap: 3px;
  background: rgba(255, 255, 255, 0.7); border: 1px solid #fde68a;
  border-radius: 999px; padding: 4px 10px; font-size: 11px;
  color: #92400e; cursor: pointer;
}
.ai-refresh-icon {
  font-size: 12px;
  line-height: 1;
  display: inline-flex;
}
.ai-refresh:disabled { opacity: 0.6; cursor: not-allowed; }
.ai-list { margin: 0; padding-left: 20px; }
.ai-list li {
  font-size: 13px; line-height: 1.9; color: #4b5563;
  list-style: '💧  ';
}
.ai-loading { display: flex; flex-direction: column; gap: 8px; padding: 4px 0; }
.skeleton {
  height: 14px; border-radius: 6px;
  background: linear-gradient(90deg, rgba(255,255,255,0.6), rgba(255,255,255,0.9), rgba(255,255,255,0.6));
  background-size: 200% 100%;
  animation: shimmer 1.4s infinite;
}
.skeleton.short { width: 60%; }
@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
.ai-empty { font-size: 12px; color: var(--text-tertiary); text-align: center; padding: 8px 0; }
.section-title { font-size: 14px; font-weight: 600; margin-bottom: 10px; }
.section-title-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
.link { font-size: 12px; color: var(--brand); cursor: pointer; }
.quick-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
.quick {
  background: white; border-radius: 12px; padding: 14px 8px;
  text-align: center; box-shadow: var(--shadow);
  border: 2px solid transparent; cursor: pointer;
  transition: transform 0.1s;
}
.quick:active { transform: scale(0.96); }
.quick.highlight { background: var(--brand); box-shadow: var(--shadow-brand); }
.quick .drops { font-size: 14px; margin-bottom: 4px; }
.quick .v { font-size: 18px; font-weight: 700; }
.quick .u { font-size: 10px; color: var(--text-secondary); margin-top: 2px; }
.quick.highlight .v { color: white; }
.quick.highlight .u { color: var(--brand-light); }

.cup-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
.cup {
  background: white; border-radius: 12px; padding: 12px 8px;
  text-align: center; box-shadow: var(--shadow); cursor: pointer;
}
.cup:active { transform: scale(0.96); }
.emoji { font-size: 24px; }
.name { font-size: 11px; font-weight: 600; margin-top: 4px; }
.cap { font-size: 10px; color: var(--text-secondary); }

.records { padding: 8px 16px; }
.record-item {
  display: flex; align-items: center; padding: 12px 0;
  border-bottom: 1px solid #f3f4f6;
}
.record-item:last-child { border-bottom: none; }
.dot { width: 6px; height: 6px; background: var(--brand); border-radius: 50%; margin-right: 8px; }
.rname { flex: 1; font-size: 13px; }
.ramount { font-size: 13px; font-weight: 600; margin-right: 8px; }
.rtime { font-size: 11px; color: var(--text-tertiary); }
.rdel { margin-left: 8px; color: var(--text-tertiary); cursor: pointer; }
.empty { text-align: center; padding: 32px 0; color: var(--text-secondary); font-size: 13px; }
.empty-emoji { font-size: 36px; margin-bottom: 8px; }
</style>