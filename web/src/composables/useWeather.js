/**
 * 天气 composable（混合模式）
 *  - 默认从 localStorage 读取城市（北京），调用 /api/weather?city=NAME
 *  - 提供 locate() 自动定位：浏览器 Geolocation + /api/weather?lat=X&lon=Y
 *  - 自动定位后保留显示城市（来自 localStorage），只更新温度/图标
 *  - 任何步骤失败都静默降级，UI 不显示
 */
import { ref, onMounted } from 'vue';
import { weatherApi, geoApi } from '../api';

const DEFAULT_CITY = '北京';
const CITY_KEY = 'weather:city';

const GEO_OPTIONS = {
  enableHighAccuracy: false,
  timeout: 8000,
  maximumAge: 30 * 60 * 1000, // 30 分钟内复用浏览器缓存
};

export function useWeather() {
  const weather = ref(null);
  // state: idle | locating | fetching | ok | unsupported | denied | failed
  const state = ref('idle');
  const displayCity = ref(readCity());

  function readCity() {
    try {
      return localStorage.getItem(CITY_KEY) || DEFAULT_CITY;
    } catch {
      return DEFAULT_CITY;
    }
  }

  /** 按城市名查询 */
  async function load(city = displayCity.value) {
    if (!city) return;
    state.value = 'fetching';
    try {
      const res = await weatherApi.byCity(city);
      if (res?.ok) {
        weather.value = res;
        displayCity.value = city;
        try { localStorage.setItem(CITY_KEY, city); } catch {}
        state.value = 'ok';
      } else {
        state.value = 'failed';
      }
    } catch {
      state.value = 'failed';
    }
  }

  /** 按坐标查询（跳过正向地理编码，适合已有坐标的场景如 IP 定位） */
  async function loadByCoords(lat, lon, displayName) {
    state.value = 'fetching';
    try {
      const res = await weatherApi.byCoords(lat, lon);
      if (res?.ok) {
        // 使用传入的 displayName 作为状态行显示城市（去掉“市”后缀）
        weather.value = { ...res, city: displayName || '当前位置' };
        displayCity.value = displayName || '当前位置';
        state.value = 'ok';
      } else {
        state.value = 'failed';
      }
    } catch {
      state.value = 'failed';
    }
  }

  /** 切换显示城市（手动选择） */
  async function changeCity(city) {
    if (!city || city === displayCity.value) return;
    await load(city);
  }

  /** 浏览器自动定位：用真实坐标拿天气，但保留显示城市 */
  async function locate() {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      state.value = 'unsupported';
      throw new Error('UNSUPPORTED');
    }
    state.value = 'locating';
    let pos;
    try {
      pos = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, GEO_OPTIONS);
      });
    } catch (e) {
      // 1 = PERMISSION_DENIED, 2 = POSITION_UNAVAILABLE, 3 = TIMEOUT
      state.value = e?.code === 1 ? 'denied' : 'failed';
      throw e;
    }
    state.value = 'fetching';
    try {
      const res = await weatherApi.byCoords(pos.coords.latitude, pos.coords.longitude);
      if (res?.ok) {
        // 关键：保留显示城市（用户选择），不覆盖到 res.city
        // 这样 statusLine 显示的是用户选择的城市名
        weather.value = { ...res, city: displayCity.value };
        state.value = 'ok';
      } else {
        state.value = 'failed';
        throw new Error('FETCH_FAILED');
      }
    } catch (e) {
      state.value = 'failed';
      throw e;
    }
  }

  /** 决定首次加载要使用的信息：
   *  1. localStorage 有用户之前选过的城市 → 用城市名查
   *  2. 否则调 /api/geo/ip 拿当前城市 + 坐标 → 直接用坐标查（避免 Open-Meteo 匹配不到"市"后缀）
   *  3. 失败 fallback 到 DEFAULT_CITY（北京）
   *
   *  返回 { city, lat, lon }
   *  - city: 用于状态行显示（已去掉"市"后缀）
   *  - lat/lon: 如果 IP 定位拿到了坐标，直接用坐标查（更稳定） */
  async function resolveInitial() {
    const stored = readCity();
    // localStorage 中是用户主动选过的（不是默认值"北京"），优先使用
    if (stored && stored !== DEFAULT_CITY) {
      return { city: stored, lat: null, lon: null };
    }
    // 尝试 IP 定位
    try {
      const r = await geoApi.byIp();
      if (r?.ok && r?.city) {
        // 去掉"市/地区/自治州"等后缀，避免 Open-Meteo 匹配失败
        const displayName = String(r.city).replace(/(市|地区|自治州|盟)$/u, '') || r.city;
        // 如果 lat/lon 都有，直接走坐标路径
        if (typeof r.lat === 'number' && typeof r.lon === 'number') {
          return { city: displayName, lat: r.lat, lon: r.lon };
        }
        return { city: displayName, lat: null, lon: null };
      }
    } catch (e) { /* 静默 */ }
    return { city: DEFAULT_CITY, lat: null, lon: null };
  }

  onMounted(async () => {
    const init = await resolveInitial();
    if (init.lat != null && init.lon != null) {
      await loadByCoords(init.lat, init.lon, init.city);
    } else {
      await load(init.city);
    }
  });

  return {
    weather,
    state,
    displayCity,
    changeCity,
    refresh: () => load(),
    locate,
    loadByCoords,
  };
}