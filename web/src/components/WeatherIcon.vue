<!--
  WeatherIcon.vue
  基于 @meteocons/svg（Meteocons）的 Vue 3 动画天气图标组件。
  - 使用 CSS mask-image 技术，把 SVG 当作遮罩层，背景色即为图标颜色
  - 通过 prop color 实时自定义图标颜色（默认 #64748b 蓝灰）
  - SVG 内嵌 SMIL <animate>，动画不受影响
  - 按需动态加载，体积小
-->
<template>
  <div
    v-if="iconSrc"
    class="weather-icon"
    :style="{
      width: `${size}px`,
      height: `${size}px`,
      WebkitMaskImage: `url(${iconSrc})`,
      maskImage: `url(${iconSrc})`,
      backgroundColor: color,
    }"
  />
</template>

<script setup>
import { ref, watch } from 'vue';

// 在 defineProps 之前声明 importer 表（避免 Vue 编译时引用未定义变量）
const ICON_IMPORTERS = {
  'clear-day': () => import('@meteocons/svg/fill/clear-day.svg?url'),
  'clear-night': () => import('@meteocons/svg/fill/clear-night.svg?url'),
  'partly-cloudy-day': () => import('@meteocons/svg/fill/partly-cloudy-day.svg?url'),
  'partly-cloudy-night': () => import('@meteocons/svg/fill/partly-cloudy-night.svg?url'),
  'cloudy': () => import('@meteocons/svg/fill/cloudy.svg?url'),
  'rain': () => import('@meteocons/svg/fill/rain.svg?url'),
  'drizzle': () => import('@meteocons/svg/fill/drizzle.svg?url'),
  'snow': () => import('@meteocons/svg/fill/snow.svg?url'),
  'sleet': () => import('@meteocons/svg/fill/sleet.svg?url'),
  'thunderstorms': () => import('@meteocons/svg/fill/thunderstorms.svg?url'),
  'fog': () => import('@meteocons/svg/fill/fog.svg?url'),
  'mist': () => import('@meteocons/svg/fill/mist.svg?url'),
  'haze': () => import('@meteocons/svg/fill/haze.svg?url'),
};

const props = defineProps({
  slug: { type: String, default: 'clear-day' },
  size: { type: Number, default: 96 },
  // 通过 mask-image 自定义图标颜色（任意 CSS 颜色值）
  color: { type: String, default: '#64748b' },
});

const iconSrc = ref(null);
let currentSlug = null;

async function loadIcon(slug) {
  if (slug === currentSlug && iconSrc.value) return;
  currentSlug = slug;
  const importer = ICON_IMPORTERS[slug] || ICON_IMPORTERS['clear-day'];
  try {
    const mod = await importer();
    iconSrc.value = mod.default;
  } catch (e) {
    console.error('[WeatherIcon] 加载失败:', slug, e);
    iconSrc.value = null;
  }
}

watch(
  () => props.slug,
  (slug) => {
    loadIcon(slug);
  },
  { immediate: true },
);
</script>

<style scoped>
.weather-icon {
  display: block;
  pointer-events: none;
  user-select: none;
  -webkit-user-drag: none;
  /* 让 mask 使用 alpha 通道（而非 luminance），
     这样 SVG 中 fill="black" 的区域 alpha=1，可正常显示为背景色 */
  mask-mode: alpha;
  -webkit-mask-mode: alpha;
  mask-size: contain;
  -webkit-mask-size: contain;
  mask-repeat: no-repeat;
  -webkit-mask-repeat: no-repeat;
  mask-position: center;
  -webkit-mask-position: center;
  transition: background-color 0.4s ease;
}
</style>