<template>
  <div class="profile">
    <header class="page-header">
      <div class="title">我的</div>
      <van-icon name="setting-o" size="20" />
    </header>

    <div class="user-card">
      <div class="avatar">{{ (auth.user?.nickname || '?')[0] }}</div>
      <div class="info">
        <div class="name">{{ auth.user?.nickname || auth.user?.username }}</div>
        <div class="goal">每日目标 {{ auth.user?.goal }} ml</div>
      </div>
      <van-button size="small" plain hairline color="#ffffff" @click="showGoal = true">调整目标</van-button>
    </div>

    <div class="menu card">
      <van-cell title="🎯 每日目标" :value="`${auth.user?.goal} ml`" is-link @click="showGoal = true" />
      <van-cell title="🔔 喝水提醒" is-link to="/reminder" />
      <van-cell title="🥤 杯型管理" is-link to="/cups" />
      <van-cell title="📊 数据导出" is-link @click="exportData" />
      <van-cell title="ℹ️ 关于" is-link @click="about = true" />
    </div>

    <div class="menu card">
      <van-cell title="退出登录" value-class="danger" @click="logout" />
    </div>

    <!-- 调整目标弹窗 -->
    <van-popup v-model:show="showGoal" position="bottom" round :style="{ padding: '20px' }">
      <div class="popup-title">调整每日目标</div>
      <div class="popup-value">{{ tempGoal }}<small>ml</small></div>
      <van-slider v-model="tempGoal" :min="500" :max="4000" :step="50" bar-height="6px" active-color="var(--brand)" />
      <van-button block round type="primary" size="large" style="margin-top: 20px;" @click="saveGoal">保存</van-button>
    </van-popup>

    <van-dialog v-model:show="about" title="每日喝水">
      <div style="padding: 16px;">
        版本 v1.0.0 · 单容器 Docker 部署<br>
        Vue 3 + Express + Prisma + SQLite
      </div>
    </van-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { showToast, showConfirmDialog } from 'vant';
import { useAuthStore } from '../stores/auth';
import { userApi } from '../api';

const auth = useAuthStore();
const router = useRouter();
const showGoal = ref(false);
const about = ref(false);
const tempGoal = ref(2000);

onMounted(async () => {
  if (auth.user) tempGoal.value = auth.user.goal;
});

async function saveGoal() {
  await userApi.update({ goal: tempGoal.value });
  await auth.refreshUser();
  showGoal.value = false;
  showToast('已保存');
}

async function logout() {
  await showConfirmDialog({ title: '退出登录', message: '确定要退出吗？' });
  auth.logout();
  router.replace('/login');
}

async function exportData() {
  // 极简导出：JSON 下载
  const { records } = await import('../api').then((m) => m.recordApi.list());
  const blob = new Blob([JSON.stringify(records, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `drink-records-${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  showToast('已导出');
}
</script>

<style scoped>
.profile { padding: 16px 16px 80px; max-width: 720px; margin: 0 auto; }
.page-header { display: flex; justify-content: space-between; align-items: center; padding: 8px 0 16px; }
.title { font-size: 20px; font-weight: 700; }
.user-card {
  display: flex; align-items: center; gap: 14px;
  background: linear-gradient(135deg, var(--brand), var(--brand-dark));
  border-radius: 16px; padding: 16px 18px; color: white;
  box-shadow: var(--shadow-brand); margin-bottom: 16px;
}
.user-card :deep(.van-button) {
  color: #ffffff !important;
  background: rgba(255,255,255,0.15) !important;
  border-color: rgba(255,255,255,0.6) !important;
  font-weight: 500;
}
.user-card :deep(.van-button .van-button__text),
.user-card :deep(.van-button__text) {
  color: #ffffff !important;
}
.avatar {
  width: 48px; height: 48px; background: rgba(255,255,255,0.25);
  border-radius: 50%; display: flex; align-items: center; justify-content: center;
  font-size: 22px; font-weight: 700;
}
.info { flex: 1; }
.name { font-size: 16px; font-weight: 600; }
.goal { font-size: 12px; opacity: 0.85; margin-top: 2px; }
.menu { margin-bottom: 12px; overflow: hidden; }
.menu :deep(.van-cell) { padding: 14px 16px; }
.danger { color: #ef4444 !important; }

.popup-title { font-size: 16px; font-weight: 700; margin-bottom: 12px; }
.popup-value { text-align: center; font-size: 40px; font-weight: 700; color: var(--brand); margin-bottom: 16px; }
.popup-value small { font-size: 14px; color: var(--text-secondary); margin-left: 4px; font-weight: 400; }
</style>