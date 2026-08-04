<template>
  <div class="login">
    <div class="brand">
      <div class="logo">💧</div>
      <div class="title">每日喝水</div>
      <div class="subtitle">让喝水变成一种习惯</div>
    </div>

    <van-tabs v-model:active="mode" sticky>
      <van-tab title="登录" name="login" />
      <van-tab title="注册" name="register" />
    </van-tabs>

    <div class="form">
      <van-cell-group inset>
        <van-field
          v-model="username"
          label="用户名"
          placeholder="字母/数字/下划线"
          :rules="[{ required: true }]"
        />
        <van-field
          v-model="password"
          label="密码"
          type="password"
          placeholder="至少 6 位"
          :rules="[{ required: true }]"
        />
        <van-field
          v-if="mode === 'register'"
          v-model="nickname"
          label="昵称"
          placeholder="选填"
        />
      </van-cell-group>

      <van-button
        block
        round
        type="primary"
        size="large"
        :loading="loading"
        @click="submit"
      >{{ mode === 'login' ? '登录' : '注册' }}</van-button>

      <div class="hint center muted">
        演示账号 <b>demo / demo1234</b>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { showToast } from 'vant';
import { useAuthStore } from '../stores/auth';

const auth = useAuthStore();
const router = useRouter();
const route = useRoute();

const mode = ref('login');
const username = ref('');
const password = ref('');
const nickname = ref('');
const loading = ref(false);

async function submit() {
  if (!username.value || !password.value) {
    return showToast('请输入用户名和密码');
  }
  loading.value = true;
  try {
    if (mode.value === 'login') {
      await auth.login(username.value, password.value);
    } else {
      await auth.register(username.value, password.value, nickname.value);
    }
    const redirect = route.query.redirect || '/';
    router.replace(redirect);
  } catch (e) {
    // toast already shown by http interceptor
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
.login {
  min-height: 100vh;
  background: linear-gradient(180deg, #ecfdf5, #fff 60%);
  padding-top: 60px;
}
.brand { text-align: center; margin-bottom: 32px; }
.logo { font-size: 56px; margin-bottom: 8px; }
.title { font-size: 24px; font-weight: 700; }
.subtitle { font-size: 13px; color: var(--text-secondary); margin-top: 4px; }
.form { padding: 0 16px; }
.form .van-button { margin-top: 24px; }
.hint { margin-top: 16px; font-size: 12px; }
</style>