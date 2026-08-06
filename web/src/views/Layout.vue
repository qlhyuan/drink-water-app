<template>
  <div class="layout" :class="{ desktop: isDesktop }">
    <!-- 桌面端侧边栏 -->
    <aside v-if="isDesktop" class="sidebar">
      <div class="brand">💧 每日喝水</div>
      <nav>
        <router-link v-for="t in tabs" :key="t.path" :to="t.path" class="nav-link">
          <span class="icon"><van-icon :name="t.icon" /></span>
          <span>{{ t.label }}</span>
        </router-link>
      </nav>
      <div class="footer">
        <router-link to="/reminder" class="muted-link">⚙️ 提醒设置</router-link>
      </div>
    </aside>

    <main class="main">
      <router-view />
    </main>

    <!-- 移动端底部 tabbar -->
    <van-tabbar v-if="!isDesktop" v-model="activeTab" active-color="var(--brand)">
      <van-tabbar-item
        v-for="(t, i) in tabs"
        :key="t.path"
        :icon="t.icon"
        @click="onTabClick(t, i)"
      >{{ t.label }}</van-tabbar-item>
    </van-tabbar>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

const tabs = [
  { path: '/', label: '首页', icon: 'home-o' },
  { path: '/history', label: '历史', icon: 'chart-trending-o' },
  { path: '/achievements', label: '成就', icon: 'medal-o' },
  { path: '/profile', label: '我的', icon: 'user-o' },
];
const activeTab = ref(0);
const isDesktop = ref(window.innerWidth >= 768);
const route = useRoute();
const router = useRouter();

const onResize = () => (isDesktop.value = window.innerWidth >= 768);
onMounted(() => window.addEventListener('resize', onResize));
onUnmounted(() => window.removeEventListener('resize', onResize));

// 根据当前路由同步 activeTab
function syncTabFromRoute() {
  const idx = tabs.findIndex((t) => t.path === route.path);
  // 只在路由属于 tabbar 列表时才同步索引，否则保持当前索引（避免其他页面跳一下高亮）
  if (idx >= 0) activeTab.value = idx;
}
watch(() => route.path, syncTabFromRoute, { immediate: true });

// 点击 tabbar 项手动跳转（避免 Vant 默认的“已激活不响应”逻辑）
function onTabClick(t, i) {
  activeTab.value = i;
  if (route.path !== t.path) {
    router.push(t.path);
  }
}
</script>

<style scoped>
.layout { min-height: 100vh; background: var(--bg); }
.layout.desktop { display: flex; }
.sidebar {
  width: 200px;
  background: white;
  border-right: 1px solid var(--border);
  padding: 24px 16px;
  display: flex;
  flex-direction: column;
  position: sticky;
  top: 0;
  height: 100vh;
}
.sidebar .brand { font-size: 18px; font-weight: 700; margin-bottom: 24px; }
.sidebar nav { display: flex; flex-direction: column; gap: 4px; }
.nav-link {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 12px; border-radius: 10px;
  color: var(--text-secondary); font-size: 14px;
}
.nav-link:hover { background: var(--brand-bg); }
.nav-link.router-link-active { background: var(--brand-light); color: var(--brand-dark); font-weight: 600; }
.icon { font-size: 18px; }
.sidebar .footer { margin-top: auto; padding-top: 16px; border-top: 1px solid var(--border); }
.muted-link { color: var(--text-secondary); font-size: 13px; }
.main { flex: 1; min-width: 0; padding-bottom: 64px; }
.layout.desktop .main { padding-bottom: 0; max-width: 100%; }
@media (min-width: 768px) {
  .main { padding: 0; }
}
</style>