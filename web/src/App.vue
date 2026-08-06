<template>
  <div class="app-root">
    <router-view v-slot="{ Component }">
      <transition name="fade" mode="out-in">
        <component :is="Component" />
      </transition>
    </router-view>
    <ReminderDialog />
  </div>
</template>

<script setup>
import { onMounted, watch } from 'vue';
import { useAuthStore } from './stores/auth';
import { startReminder, stopReminder } from './utils/reminder';
import ReminderDialog from './components/ReminderDialog.vue';

const auth = useAuthStore();
onMounted(() => auth.bootstrap());

// 登录后启动全局提醒调度，登出时停止
watch(
  () => auth.isLogin,
  (v) => {
    if (v) startReminder();
    else stopReminder();
  },
);
</script>

<style>
.app-root { min-height: 100%; }
.fade-enter-active, .fade-leave-active { transition: opacity 0.15s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>