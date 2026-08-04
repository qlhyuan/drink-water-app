<template>
  <div class="ach">
    <header class="page-header">
      <div class="title">成就墙</div>
      <van-icon name="medal-o" size="20" />
    </header>

    <div class="stats-card">
      <div class="lbl">已解锁成就</div>
      <div class="val">{{ unlocked }}<small>/ {{ achievements.length }}</small></div>
      <div class="bar"><div class="fill" :style="{ width: `${(unlocked / achievements.length) * 100}%` }"></div></div>
      <div class="meta">继续努力 ✨</div>
    </div>

    <van-tabs v-model:active="tab">
      <van-tab :title="`全部 (${achievements.length})`" />
      <van-tab :title="`已解锁 (${unlocked})`" />
      <van-tab :title="`未解锁 (${achievements.length - unlocked})`" />
    </van-tabs>

    <div class="grid">
      <div
        v-for="a in filtered"
        :key="a.id"
        class="ach-card"
        :class="{ unlocked: a.unlocked }"
        @click="showDetail(a)"
      >
        <div class="lock" v-if="!a.unlocked">🔒</div>
        <div class="ico">{{ a.emoji }}</div>
        <div class="name">{{ a.name }}</div>
        <div class="desc" v-html="a.desc"></div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRecordStore } from '../stores/record';

const store = useRecordStore();
const tab = ref(0);

const achievements = computed(() => [
  { id: 'first', name: '初次尝试', emoji: '🌱', desc: '记录第一次', unlocked: store.today.records.length > 0 },
  { id: 'thousand', name: '小试牛刀', emoji: '💧', desc: '单日喝够<br>1000ml', unlocked: store.today.total >= 1000 },
  { id: 'goal', name: '完美达标', emoji: '🎯', desc: '连续 7 天<br>完成目标', unlocked: store.stats.streak >= 7 },
  { id: 'streak7', name: '连续一周', emoji: '🔥', desc: '连续 7 天<br>不间断', unlocked: store.stats.streak >= 7 },
  { id: 'fast', name: '闪电喝水', emoji: '⚡', desc: '1 小时内<br>喝 500ml', unlocked: false },
  { id: 'master', name: '水之达人', emoji: '🌊', desc: '累计喝够<br>100L', unlocked: store.stats.total >= 100000 },
  { id: 'morning', name: '晨起第一杯', emoji: '🌅', desc: '连续 7 天<br>8 点前喝水', unlocked: false },
  { id: 'night', name: '深夜记录', emoji: '🌙', desc: '22 点后<br>记录一次', unlocked: false },
  { id: '30days', name: '30 天坚持', emoji: '💎', desc: '连续 30 天<br>完成目标', unlocked: store.stats.streak >= 30 },
]);

const unlocked = computed(() => achievements.value.filter((a) => a.unlocked).length);
const filtered = computed(() => {
  if (tab.value === 1) return achievements.value.filter((a) => a.unlocked);
  if (tab.value === 2) return achievements.value.filter((a) => !a.unlocked);
  return achievements.value;
});

function showDetail(a) {
  // 极简：toast
  // eslint-disable-next-line no-alert
  alert(`${a.unlocked ? '✅ 已解锁' : '🔒 未解锁'}\n${a.name}\n${a.desc.replace(/<br>/g, '\n')}`);
}

onMounted(() => Promise.all([store.fetchToday(), store.fetchStats(30)]));
</script>

<style scoped>
.ach { padding: 16px; max-width: 920px; margin: 0 auto; }
.page-header { display: flex; justify-content: space-between; align-items: center; padding: 8px 0 16px; }
.title { font-size: 20px; font-weight: 700; }
.stats-card {
  background: linear-gradient(135deg, var(--brand), var(--brand-dark));
  border-radius: 16px; padding: 18px 20px; color: white; margin-bottom: 16px;
  box-shadow: var(--shadow-brand); position: relative; overflow: hidden;
}
.stats-card::before {
  content: ''; position: absolute; top: -30px; right: -30px;
  width: 100px; height: 100px; background: rgba(255,255,255,0.15); border-radius: 50%;
}
.lbl { font-size: 12px; opacity: 0.9; }
.val { font-size: 30px; font-weight: 700; margin: 4px 0; }
.val small { font-size: 14px; opacity: 0.85; font-weight: 400; margin-left: 4px; }
.bar { background: rgba(255,255,255,0.25); height: 6px; border-radius: 3px; margin-top: 10px; overflow: hidden; }
.fill { background: white; height: 100%; border-radius: 3px; transition: width 0.4s; }
.meta { font-size: 11px; opacity: 0.9; margin-top: 8px; }
.grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-top: 12px; }
.ach-card {
  background: white; border-radius: 12px; padding: 14px 8px; text-align: center;
  box-shadow: var(--shadow); position: relative;
  opacity: 0.45; filter: grayscale(0.8); cursor: pointer;
}
.ach-card.unlocked { opacity: 1; filter: none; border: 2px solid var(--brand-light); }
.lock { position: absolute; top: 6px; right: 6px; font-size: 12px; }
.ico {
  width: 48px; height: 48px; margin: 0 auto 8px;
  background: linear-gradient(135deg, #fbbf24, #f59e0b);
  border-radius: 50%; display: flex; align-items: center; justify-content: center;
  font-size: 24px; box-shadow: 0 4px 12px rgba(251,191,36,0.3);
}
.ach-card.unlocked .ico { background: linear-gradient(135deg, var(--brand-light), var(--brand)); box-shadow: 0 4px 12px rgba(16,185,129,0.3); }
.name { font-size: 12px; font-weight: 600; }
.desc { font-size: 10px; color: var(--text-secondary); margin-top: 4px; line-height: 1.4; }
</style>