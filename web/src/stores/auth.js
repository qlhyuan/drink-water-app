import { defineStore } from 'pinia';
import { authApi, userApi } from '../api';

export const useAuthStore = defineStore('auth', {
  state: () => ({
    token: localStorage.getItem('token') || '',
    user: null,
    bootstrapped: false,
  }),
  getters: {
    isLogin: (s) => !!s.token && !!s.user,
    needOnboarding: (s) => s.user && (s.user.weight == null || s.user.activity == null),
  },
  actions: {
    async bootstrap() {
      if (!this.token) {
        this.bootstrapped = true;
        return;
      }
      try {
        this.user = await userApi.me();
      } catch {
        this.token = '';
        localStorage.removeItem('token');
      } finally {
        this.bootstrapped = true;
      }
    },
    async login(username, password) {
      const { token, user } = await authApi.login(username, password);
      this.token = token;
      this.user = user;
      localStorage.setItem('token', token);
    },
    async register(username, password, nickname) {
      const { token, user } = await authApi.register(username, password, nickname);
      this.token = token;
      this.user = user;
      localStorage.setItem('token', token);
    },
    logout() {
      this.token = '';
      this.user = null;
      localStorage.removeItem('token');
    },
    async refreshUser() {
      this.user = await userApi.me();
    },
  },
});