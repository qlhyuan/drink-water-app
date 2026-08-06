<template>
  <div class="home">
    <header class="page-header">
      <div>
        <div class="greeting">早上好 👋</div>
        <div class="title">今天喝水啦</div>
      </div>
      <router-link to="/reminder" class="bell">🔔</router-link>
    </header>

    <div class="progress-card card">
      <ProgressRing :total="store.today.total" :goal="store.today.goal" />
      <div class="info">
        <div class="remain">还差 {{ store.remaining }}ml</div>
        <div class="encourage">{{ encourage }}</div>
        <div class="streak">🔥 连续 {{ store.stats.streak || 0 }} 天</div>
      </div>
    </div>

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
import { onMounted, ref, computed } from 'vue';
import dayjs from 'dayjs';
import { showToast } from 'vant';
import { cupApi } from '../api';
import { useRecordStore } from '../stores/record';
import { useAuthStore } from '../stores/auth';
import { useHeartbeat } from '../composables/useHeartbeat';
import ProgressRing from '../components/ProgressRing.vue';
import RecordSheet from '../components/RecordSheet.vue';
import AchievementDialog from '../components/AchievementDialog.vue';

const store = useRecordStore();
const auth = useAuthStore();
const showSheet = ref(false);
const showAchievement = ref(false);
const cups = ref([]);

// 启动心跳（仅在页面可见时）
useHeartbeat();

const encourage = computed(() => {
  const p = store.today.progress;
  if (p >= 100) return '🎉 今日目标完成！';
  if (p >= 70) return '再坚持一下 💪';
  if (p >= 40) return '继续加油 🚀';
  return '开始喝水吧 ✨';
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
  ]);
});
</script>

<style scoped>
.home { padding: 16px 16px 32px; max-width: 720px; margin: 0 auto; }
.page-header { display: flex; justify-content: space-between; align-items: center; padding: 8px 0 16px; }
.greeting { font-size: 12px; color: var(--text-secondary); }
.title { font-size: 20px; font-weight: 700; margin-top: 2px; }
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