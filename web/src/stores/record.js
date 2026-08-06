import { defineStore } from 'pinia';
import dayjs from 'dayjs';
import { recordApi, statsApi } from '../api';

export const useRecordStore = defineStore('record', {
  state: () => ({
    today: { records: [], total: 0, goal: 2000, progress: 0 },
    stats: { series: [], total: 0, avg: 0, reachedDays: 0, streak: 0, days: 7 },
    buckets: { 早: 0, 中: 0, 晚: 0, 夜: 0 },
    loading: false,
  }),
  getters: {
    progressDegree: (s) => Math.min(360, Math.round((s.today.total / s.today.goal) * 360)) || 0,
    remaining: (s) => Math.max(0, s.today.goal - s.today.total),
  },
  actions: {
    async fetchToday(date) {
      this.loading = true;
      try {
        this.today = await recordApi.list(date || dayjs().format('YYYY-MM-DD'));
      } finally {
        this.loading = false;
      }
    },
    async addRecord({ amount, cupType, cupEmoji }) {
      const res = await recordApi.add({ amount, cupType, cupEmoji });
      await this.fetchToday();
      return res; // 返回后端响应（含 justAchieved / achievementSent）
    },
    async removeRecord(id) {
      await recordApi.remove(id);
      await this.fetchToday();
    },
    async undo() {
      const { removed } = await recordApi.undo();
      await this.fetchToday();
      return removed;
    },
    async fetchStats(days = 7) {
      this.stats = await statsApi.overview(days);
    },
    async fetchTodayBuckets() {
      this.buckets = (await statsApi.today()).buckets;
    },
  },
});