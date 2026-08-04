<template>
  <van-popup
    :show="show"
    position="bottom"
    round
    closeable
    :style="{ maxHeight: '80%' }"
    @update:show="(v) => emit('update:show', v)"
  >
    <div class="sheet">
      <div class="title">记录一次喝水</div>

      <div class="amount-display">
        <span class="big">{{ amount }}</span>
        <span class="unit">ml</span>
        <div class="hint">{{ hint }}</div>
      </div>

      <div class="stepper">
        <button class="step-btn" @click="amount = Math.max(10, amount - 50)">−</button>
        <div class="step-value">{{ amount }}</div>
        <button class="step-btn primary" @click="amount = Math.min(3000, amount + 50)">+</button>
      </div>

      <div class="quick-row">
        <div
          v-for="q in quickOptions"
          :key="q"
          class="chip"
          :class="{ active: amount === q }"
          @click="amount = q"
        >{{ q }}</div>
      </div>

      <div class="cup-list">
        <div
          v-for="c in cups"
          :key="c.id"
          class="cup"
          :class="{ active: selectedCup === c.id }"
          @click="pickCup(c)"
        >
          <div class="emoji">{{ c.emoji }}</div>
          <div class="name">{{ c.name }}</div>
          <div class="cap">{{ c.capacity }}ml</div>
        </div>
      </div>

      <van-button
        type="primary"
        block
        round
        size="large"
        style="margin-top: 16px;"
        @click="submit"
      >💧 完成记录</van-button>
    </div>
  </van-popup>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import dayjs from 'dayjs';
import { cupApi } from '../api';

const props = defineProps({
  show: Boolean,
  defaultAmount: { type: Number, default: 250 },
});
const emit = defineEmits(['update:show', 'submit']);

const amount = ref(props.defaultAmount);
const selectedCup = ref(null);
const cups = ref([]);

const quickOptions = [100, 200, 250, 500];

const hint = computed(() => {
  if (selectedCup.value) {
    const c = cups.value.find((x) => x.id === selectedCup.value);
    if (c) return `≈ ${c.name}`;
  }
  if (amount.value >= 1000) return `≈ ${(amount.value / 250).toFixed(1)} 杯`;
  return `约 ${Math.round(amount.value / 250 * 10) / 10} 杯马克杯`;
});

watch(() => props.show, async (v) => {
  if (v) {
    amount.value = props.defaultAmount;
    selectedCup.value = null;
    const { defaults, customs } = await cupApi.list();
    cups.value = [...defaults, ...customs];
  }
});

function pickCup(c) {
  selectedCup.value = c.id;
  amount.value = c.capacity;
}

async function submit() {
  const c = cups.value.find((x) => x.id === selectedCup.value);
  emit('submit', {
    amount: amount.value,
    cupType: c?.name || '快速记录',
    cupEmoji: c?.emoji || '💧',
    recordedAt: dayjs().toISOString(),
  });
}
</script>

<style scoped>
.sheet { padding: 24px 20px 32px; }
.title { font-size: 16px; font-weight: 700; margin-bottom: 16px; }
.amount-display { text-align: center; padding: 8px 0 16px; }
.big { font-size: 48px; font-weight: 700; color: var(--brand); font-variant-numeric: tabular-nums; }
.unit { font-size: 16px; color: var(--text-secondary); margin-left: 4px; }
.hint { font-size: 12px; color: var(--text-tertiary); margin-top: 4px; }
.stepper { display: flex; align-items: center; justify-content: center; gap: 16px; margin-bottom: 16px; }
.step-btn {
  width: 44px; height: 44px; border-radius: 50%;
  background: var(--brand-light); color: var(--brand-dark);
  font-size: 22px; font-weight: 700; border: 0;
}
.step-btn.primary {
  width: 56px; height: 56px; background: var(--brand); color: white;
  font-size: 26px; box-shadow: var(--shadow-brand);
}
.step-value { font-size: 28px; font-weight: 700; min-width: 70px; text-align: center; }
.quick-row { display: flex; gap: 8px; margin-bottom: 16px; }
.chip {
  flex: 1; background: #f3f4f6; border-radius: 10px; padding: 10px;
  text-align: center; font-size: 13px; font-weight: 600;
}
.chip.active { background: var(--brand-light); color: var(--brand-dark); border: 1px solid var(--brand); }
.cup-list { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
.cup {
  background: white; border: 2px solid #f3f4f6; border-radius: 12px;
  padding: 10px 6px; text-align: center;
}
.cup.active { border-color: var(--brand); background: var(--brand-light); }
.emoji { font-size: 22px; }
.name { font-size: 11px; font-weight: 600; margin-top: 4px; }
.cap { font-size: 10px; color: var(--text-secondary); }
</style>