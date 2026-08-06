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
        <div class="time-box" @click="pickStart">
          <div class="time-label">开始</div>
          <div class="time-value">{{ form.startTime }}</div>
          <div class="time-edit">点击修改 <van-icon name="arrow" /></div>
        </div>
        <div class="time-sep">至</div>
        <div class="time-box" @click="pickEnd">
          <div class="time-label">结束</div>
          <div class="time-value">{{ form.endTime }}</div>
          <div class="time-edit">点击修改 <van-icon name="arrow" /></div>
        </div>
      </div>
      <div class="time-hint">将在该时段内每 {{ form.interval }} 分钟提醒一次</div>
    </div>

    <div class="section">
      <div class="label">提醒方式</div>
      <van-cell center title="✈️ 飞书消息提醒" :value="feishuBound ? '已开启' : '未绑定'" :label="feishuBound ? '到点推送到你的飞书消息' : '在登录页使用飞书一键登录后自动启用'">
        <template #right-icon><van-icon name="chat-o" color="#3370ff" /></template>
      </van-cell>
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
import { reminderApi, userApi } from '../api';
import { refreshReminder } from '../utils/reminder';

const form = reactive({
  enabled: true, interval: 60, startTime: '08:00', endTime: '22:00',
  vibrate: true, dnd: true, inApp: true, browser: false, sound: true, smartMode: true,
  timezone: formatTimezoneOffset(),
});
const original = ref(null);
const feishuBound = ref(false);
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
  // 自动附带浏览器时区偏移，确保后端提醒 worker 能正确判断用户本地时间
  const tzOffset = formatTimezoneOffset();
  await reminderApi.update({ ...form, timezone: tzOffset });
  original.value = { ...form, timezone: tzOffset };
  await refreshReminder(); // 让全局调度器立即采用新时段/间隔
  showToast('已保存');
}

/** 获取浏览器 UTC 偏移，格式 "+HH:MM" 或 "-HH:MM" */
function formatTimezoneOffset() {
  const offset = -new Date().getTimezoneOffset(); // 分钟，东半球为正
  const sign = offset >= 0 ? '+' : '-';
  const abs = Math.abs(offset);
  const h = String(Math.floor(abs / 60)).padStart(2, '0');
  const m = String(abs % 60).padStart(2, '0');
  return `${sign}${h}:${m}`;
}

onMounted(async () => {
  const r = await reminderApi.get();
  Object.assign(form, r);
  original.value = { ...form };
  try {
    const me = await userApi.me();
    feishuBound.value = !!me.feishuBound;
  } catch { /* 忽略 */ }
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
.time-range { display: flex; align-items: center; padding: 0 16px 4px; gap: 10px; }
.time-box {
  flex: 1; background: var(--bg); border: 2px solid transparent; border-radius: 12px;
  padding: 12px; text-align: center; cursor: pointer;
}
.time-box:active { border-color: var(--brand); background: var(--brand-light); }
.time-label { font-size: 11px; color: var(--text-secondary); }
.time-value { font-size: 22px; font-weight: 700; margin-top: 4px; font-variant-numeric: tabular-nums; }
.time-edit { font-size: 11px; color: var(--brand); margin-top: 4px; }
.time-sep { color: var(--text-tertiary); font-size: 13px; flex-shrink: 0; }
.time-hint { font-size: 11px; color: var(--text-tertiary); padding: 8px 16px 12px; }
</style>