<template>
  <div class="callback">
    <div class="card">
      <div v-if="status === 'loading'" class="center-box">
        <div class="spinner"></div>
        <p>正在通过飞书登录…</p>
      </div>
      <div v-else-if="status === 'error'" class="center-box">
        <div class="icon">😵</div>
        <p>{{ errorMsg }}</p>
        <van-button size="small" round @click="goLogin">返回登录</van-button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { showToast } from 'vant';
import { useAuthStore } from '../stores/auth';

const router = useRouter();
const route = useRoute();
const auth = useAuthStore();

const status = ref('loading');
const errorMsg = ref('');

onMounted(async () => {
  const code = route.query.code;
  if (!code) {
    status.value = 'error';
    errorMsg.value = '飞书授权缺少 code，请重试';
    return;
  }
  try {
    await auth.loginWithFeishu(code);
    status.value = 'loading';
    const redirect = route.query.redirect || '/';
    router.replace(redirect);
  } catch (e) {
    status.value = 'error';
    errorMsg.value = '飞书登录失败，请重试';
  }
});

function goLogin() {
  router.replace('/login');
}
</script>

<style scoped>
.callback {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(180deg, #ecfdf5, #fff 60%);
}
.card {
  width: 280px;
  padding: 32px 24px;
  background: #fff;
  border-radius: 16px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.08);
  text-align: center;
}
.center-box p { color: #6b7280; font-size: 14px; margin: 16px 0; }
.icon { font-size: 40px; }
.spinner {
  width: 32px; height: 32px;
  margin: 0 auto;
  border: 3px solid #e5e7eb;
  border-top-color: #10b981;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
</style>
