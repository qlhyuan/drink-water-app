<template>
  <div class="reminder">
    <van-nav-bar title="提醒设置" left-text="返回" left-arrow @click-left="$router.back()" :right-text="dirty ? '保存' : ''" @click-right="save" />

    <div class="smart-card">
      <span class="emoji">🤖</span>
      <div>
        <div class="t">智能提醒已开启</div>
        <div class="d">根据你的作息和饮水习惯，自动调整提醒时间，避开睡眠时段</div>
      </div>
    </div>

    <div class="section">
      <div class="label">基础设置</div>
      <van-cell center title="🔔 喝水提醒">
        <template #right-icon><van-switch v-model="form.enabled" size="22" /></template>
      </van-cell>
      <van-cell center title="⏰ 提醒间隔" :value="`每 ${form.interval} 分钟`" is-link @click="showInterval = true" />
      <van-cell center title="📳 震动">
        <template #right-icon><van-switch v-model="form.vibrate" size="22" /></template>
      </van-cell>
      <van-cell center title="🔕 免打扰（夜间自动静音）">
        <template #right-icon><van-switch v-model="form.dnd" size="22" /></template>
      </van-cell>
    </div>

    <div class="section">
      <div class="label">提醒时段</div>
      <div class="time-range">
        <van-cell clickable center :title="form.startTime" @click="pickStart" />
        <van-cell clickable center :title="form.endTime" @click="pickEnd" />
      </div>
    </div>

    <div class="section">
      <div class="label">提醒方式</div>
      <van-cell center title="💬 应用内通知">
        <template #right-icon><van-switch v-model="form.inApp" size="22" /></template>
      </van-cell>
      <van-cell center title="📢 浏览器通知">
        <template #right-icon><van-switch v-model="form.browser" size="22" @change="requestNotif" /></template>
      </van-cell>
      <van-cell center title="🎵 提示音">
        <template #right-icon><van-switch v-model="form.sound" size="22" /></template>
      </van-cell>
    </div>

    <van-popup v-model:show="showInterval" position="bottom" round>
      <van-picker
        :columns="intervalCols"
        @confirm="onIntervalConfirm"
        @cancel="showInterval = false"
        show-toolbar
      />
    </van-popup>

    <van-popup v-model:show="showTime" position="bottom" round>
      <van-time-picker
        v-model="tempTime"
        :title="timeTarget === 'start' ? '选择开始时间' : '选择结束时间'"
        @confirm="onTimeConfirm"
        @cancel="showTime = false"
      />
    </van-popup>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, computed } from 'vue';
import { showToast } from 'vant';
import { reminderApi } from '../api';

const form = reactive({
  enabled: true, interval: 60, startTime: '08:00', endTime: '22:00',
  vibrate: true, dnd: true, inApp: true, browser: false, sound: true, smartMode: true,
});
const original = ref(null);
const dirty = computed(() => JSON.stringify(form) !== JSON.stringify(original.value));

const showInterval = ref(false);
const intervalCols = Array.from({ length: 16 }, (_, i) => ({ text: `${(i + 1) * 15} 分钟`, value: (i + 1) * 15 }));

const showTime = ref(false);
const timeTarget = ref('start');
const tempTime = ref(['08', '00']);

function onIntervalConfirm({ selectedValues }) {
  form.interval = Number(selectedValues[0]);
  showInterval.value = false;
}

function pickStart() { timeTarget.value = 'start'; tempTime.value = form.startTime.split(':'); showTime.value = true; }
function pickEnd() { timeTarget.value = 'end'; tempTime.value = form.endTime.split(':'); showTime.value = true; }
function onTimeConfirm({ selectedValues }) {
  form[timeTarget.value === 'start' ? 'startTime' : 'endTime'] = selectedValues.join(':');
  showTime.value = false;
}

async function requestNotif(val) {
  if (!val || !('Notification' in window)) return;
  const p = await Notification.requestPermission();
  if (p !== 'granted') {
    form.browser = false;
    showToast('未授予通知权限');
  }
}

async function save() {
  await reminderApi.update(form);
  original.value = { ...form };
  showToast('已保存');
}

onMounted(async () => {
  const r = await reminderApi.get();
  Object.assign(form, r);
  original.value = { ...form };
});
</script>

<style scoped>
.reminder { padding-bottom: 80px; }
.smart-card {
  margin: 12px 16px; background: linear-gradient(135deg, #ecfdf5, #d1fae5);
  border-radius: 14px; padding: 14px 16px; display: flex; gap: 12px; align-items: flex-start;
  border: 1px solid var(--brand-light);
}
.smart-card .emoji { font-size: 28px; }
.smart-card .t { font-size: 14px; font-weight: 700; }
.smart-card .d { font-size: 12px; color: var(--text-secondary); margin-top: 4px; line-height: 1.5; }
.section { background: white; margin: 12px 0; }
.label { font-size: 11px; color: var(--text-tertiary); padding: 8px 16px; letter-spacing: 0.5px; }
.time-range { display: flex; }
.time-range :deep(.van-cell) { flex: 1; }
</style>