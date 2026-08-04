import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '../stores/auth';

const routes = [
  { path: '/login', component: () => import('../views/Login.vue'), meta: { guest: true } },
  { path: '/feishu/callback', component: () => import('../views/FeishuCallback.vue'), meta: { guest: true } },
  { path: '/onboarding', component: () => import('../views/Onboarding.vue') },
  {
    path: '/',
    component: () => import('../views/Layout.vue'),
    meta: { auth: true },
    children: [
      { path: '', component: () => import('../views/Home.vue') },
      { path: 'history', component: () => import('../views/History.vue') },
      { path: 'achievements', component: () => import('../views/Achievements.vue') },
      { path: 'profile', component: () => import('../views/Profile.vue') },
      { path: 'reminder', component: () => import('../views/Reminder.vue') },
    ],
  },
  { path: '/:pathMatch(.*)*', redirect: '/' },
];

const router = createRouter({ history: createWebHistory(), routes });

router.beforeEach(async (to) => {
  const auth = useAuthStore();
  if (!auth.bootstrapped) await auth.bootstrap();

  if (to.meta.auth && !auth.isLogin) return { path: '/login', query: { redirect: to.fullPath } };
  if (to.meta.guest && auth.isLogin) return { path: '/' };
  if (auth.isLogin && auth.needOnboarding && to.path !== '/onboarding') {
    return { path: '/onboarding' };
  }
});

export default router;