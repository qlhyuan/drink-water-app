<template>
  <div class="history">
    <header class="page-header">
      <div class="title">历史记录</div>
      <van-icon name="calendar-o" size="20" />
    </header>

    <van-tabs v-model:active="range" sticky @change="load">
      <van-tab :title="`近 ${r} 天`" :name="r" v-for="r in ranges" :key="r" />
    </van-tabs>

    <div class="stats-row">
      <div class="stat card">
        <div class="stat-label">日均</div>
        <div class="stat-value">{{ store.stats.avg }}<small>ml</small></div>
      </div>
      <div class="stat card">
        <div class="stat-label">达标天数</div>
        <div class="stat-value">{{ store.stats.reachedDays }}<small>/ {{ range }}</small></div>
      </div>
      <div class="stat card">
        <div class="stat-label">连续</div>
        <div class="stat-value">{{ store.stats.streak }}<small>天</small></div>
      </div>
    </div>

    <section class="block">
      <div class="section-title">每日趋势</div>
      <div class="chart card">
        <v-chart :option="lineOption" autoresize style="height: 220px;" />
      </div>
    </section>

    <section class="block">
      <div class="section-title">今日时段分布</div>
      <div class="chart card">
        <v-chart :option="pieOption" autoresize style="height: 200px;" />
      </div>
    </section>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { use } from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';
import { LineChart, PieChart } from 'echarts/charts';
import {
  GridComponent,
  TooltipComponent,
  LegendComponent,
  TitleComponent,
} from 'echarts/components';
import VChart from 'vue-echarts';
import { useRecordStore } from '../stores/record';

use([CanvasRenderer, LineChart, PieChart, GridComponent, TooltipComponent, LegendComponent, TitleComponent]);

const store = useRecordStore();
const ranges = [7, 30, 90];
const range = ref(7);

const lineOption = computed(() => ({
  tooltip: { trigger: 'axis' },
  grid: { left: 32, right: 16, top: 16, bottom: 28 },
  xAxis: {
    type: 'category',
    data: store.stats.series.map((s) => s.date.slice(5)),
    axisLine: { lineStyle: { color: '#e5e7eb' } },
    axisLabel: { color: '#6b7280', fontSize: 10 },
  },
  yAxis: {
    type: 'value',
    splitLine: { lineStyle: { color: '#f3f4f6' } },
    axisLabel: { color: '#9ca3af', fontSize: 10 },
  },
  series: [
    {
      type: 'line',
      smooth: true,
      data: store.stats.series.map((s) => s.amount),
      lineStyle: { color: '#10b981', width: 2 },
      itemStyle: { color: '#10b981' },
      areaStyle: {
        color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
          colorStops: [{ offset: 0, color: 'rgba(16,185,129,0.3)' }, { offset: 1, color: 'rgba(16,185,129,0)' }] },
      },
      markLine: {
        symbol: 'none',
        data: [{ yAxis: store.stats.goal, label: { formatter: '目标' }, lineStyle: { color: '#f59e0b', type: 'dashed' } }],
      },
    },
  ],
}));

const pieOption = computed(() => ({
  tooltip: { trigger: 'item' },
  legend: { bottom: 0, icon: 'circle', textStyle: { fontSize: 11 } },
  series: [{
    type: 'pie',
    radius: ['45%', '70%'],
    center: ['50%', '45%'],
    data: [
      { name: '早', value: store.buckets.早, itemStyle: { color: '#fbbf24' } },
      { name: '中', value: store.buckets.中, itemStyle: { color: '#10b981' } },
      { name: '晚', value: store.buckets.晚, itemStyle: { color: '#3b82f6' } },
      { name: '夜', value: store.buckets.夜, itemStyle: { color: '#8b5cf6' } },
    ],
    label: { show: false },
  }],
}));

async function load() {
  await Promise.all([store.fetchStats(range.value), store.fetchTodayBuckets()]);
}
onMounted(load);
</script>

<style scoped>
.history { padding: 16px 16px 32px; max-width: 920px; margin: 0 auto; }
.page-header { display: flex; justify-content: space-between; align-items: center; padding: 8px 0 16px; }
.title { font-size: 20px; font-weight: 700; }
.stats-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin: 12px 0 20px; }
.stat { padding: 12px; text-align: center; }
.stat-label { font-size: 11px; color: var(--text-secondary); }
.stat-value { font-size: 22px; font-weight: 700; color: var(--brand-dark); margin-top: 4px; }
.stat-value small { font-size: 12px; color: var(--text-secondary); font-weight: 400; margin-left: 2px; }
.block { margin-bottom: 20px; }
.section-title { font-size: 14px; font-weight: 600; margin-bottom: 10px; }
.chart { padding: 12px; }
</style>