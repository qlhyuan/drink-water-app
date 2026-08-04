<template>
  <div class="ring" :style="ringStyle">
    <div class="ring-inner">
      <slot>
        <div class="value">{{ total }}</div>
        <div class="target">/ {{ goal }}</div>
      </slot>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  total: { type: Number, required: true },
  goal: { type: Number, required: true },
  size: { type: Number, default: 120 },
  color: { type: String, default: 'var(--brand)' },
});

const degree = computed(() => {
  if (!props.goal) return 0;
  return Math.min(360, Math.round((props.total / props.goal) * 360));
});

const ringStyle = computed(() => ({
  width: `${props.size}px`,
  height: `${props.size}px`,
  background: `conic-gradient(${props.color} ${degree.value}deg, #e5e7eb ${degree.value}deg 360deg)`,
}));
</script>

<style scoped>
.ring {
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
}
.ring::before {
  content: '';
  position: absolute;
  inset: 8px;
  background: white;
  border-radius: 50%;
}
.ring-inner {
  position: relative;
  z-index: 2;
  text-align: center;
  line-height: 1.1;
}
.value { font-size: 22px; font-weight: 700; }
.target { font-size: 11px; color: var(--text-secondary); margin-top: 2px; }
</style>