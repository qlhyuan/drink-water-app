/**
 * /api/weather
 *  - GET /api/weather?lat=X&lon=Y       — 返回指定坐标的天气
 *  - GET /api/weather?city=NAME         — 正向地理编码（NAME → 坐标）并返回天气
 *
 * 数据源：
 *  - 天气：Open-Meteo（免费、无需 Key、稳定）
 *  - 正向地理编码：Open-Meteo search API（同服务商、稳定）
 *    已弃用 Nominatim（在中国大陆访问慢，会导致整个请求超时）
 */
import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { authMiddleware } from '../middleware/auth.js';
import { get, set } from '../ai/cache.js';

const router = Router();
router.use(authMiddleware);

const SEARCH_URL = 'https://geocoding-api.open-meteo.com/v1/search';
const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';
const GEO_TTL_MS = 24 * 60 * 60 * 1000; // 地理编码 24 小时
const WEATHER_TTL_MS = 30 * 60 * 1000;   // 天气 30 分钟

/**
 * Open-Meteo WMO 天气代码 → 中文描述 + emoji
 * 来源：https://open-meteo.com/en/docs
 */
const WEATHER_CODE_MAP = {
  0: { desc: '晴', icon: '☀️' },
  1: { desc: '晴间多云', icon: '🌤️' },
  2: { desc: '多云', icon: '⛅' },
  3: { desc: '阴', icon: '☁️' },
  45: { desc: '雾', icon: '🌫️' },
  48: { desc: '霜雾', icon: '🌫️' },
  51: { desc: '毛毛雨', icon: '🌦️' },
  53: { desc: '毛毛雨', icon: '🌦️' },
  55: { desc: '浓毛毛雨', icon: '🌦️' },
  56: { desc: '冻毛毛雨', icon: '🌧️' },
  57: { desc: '冻毛毛雨', icon: '🌧️' },
  61: { desc: '小雨', icon: '🌧️' },
  63: { desc: '中雨', icon: '🌧️' },
  65: { desc: '大雨', icon: '🌧️' },
  66: { desc: '冻雨', icon: '🌧️' },
  67: { desc: '冻雨', icon: '🌧️' },
  71: { desc: '小雪', icon: '🌨️' },
  73: { desc: '中雪', icon: '🌨️' },
  75: { desc: '大雪', icon: '❄️' },
  77: { desc: '雪粒', icon: '🌨️' },
  80: { desc: '阵雨', icon: '🌦️' },
  81: { desc: '阵雨', icon: '🌦️' },
  82: { desc: '强阵雨', icon: '⛈️' },
  85: { desc: '阵雪', icon: '🌨️' },
  86: { desc: '强阵雪', icon: '❄️' },
  95: { desc: '雷雨', icon: '⛈️' },
  96: { desc: '雷雨伴冰雹', icon: '⛈️' },
  99: { desc: '强雷雨伴冰雹', icon: '⛈️' },
};

/**
 * GET /api/weather?city=NAME
 * GET /api/weather?lat=X&lon=Y
 * 失败时返回 200 + { ok: false, error }，前端静默降级
 */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const cityQuery = (req.query.city || '').toString().trim();
    let lat = Number(req.query.lat);
    let lon = Number(req.query.lon);
    let cityLabel = null;

    // 1. city 参数优先：正向地理编码拿坐标
    if (cityQuery) {
      const geo = await forwardGeocode(cityQuery);
      if (!geo) {
        return res.json({ ok: false, error: 'CITY_NOT_FOUND', city: cityQuery });
      }
      lat = geo.latitude;
      lon = geo.longitude;
      cityLabel = geo.label;
    } else {
      // 2. lat/lon 参数：直接校验
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
        return res.json({ ok: false, error: 'INVALID_COORDS' });
      }
      if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
        return res.json({ ok: false, error: 'OUT_OF_RANGE' });
      }
    }

    // 缓存键：天气按坐标 + 当前小时聚合
    const latKey = lat.toFixed(2);
    const lonKey = lon.toFixed(2);
    const hourKey = new Date().toISOString().slice(0, 13); // YYYY-MM-DDTHH
    const cacheKey = `weather:${latKey}:${lonKey}:${hourKey}`;
    const cached = get(cacheKey);
    if (cached) return res.json({ ok: true, ...cached, cached: true });

    try {
      const forecastRes = await fetch(
        `${FORECAST_URL}?latitude=${lat}&longitude=${lon}` +
          `&current=temperature_2m,weather_code&timezone=auto`,
      );
      if (!forecastRes.ok) {
        return res.json({ ok: false, error: 'FORECAST_FAILED' });
      }
      const forecast = await forecastRes.json();
      const cur = forecast?.current;
      const code = cur?.weather_code ?? -1;
      const mapped = WEATHER_CODE_MAP[code] || { desc: '未知', icon: '🌡️' };
      const temperature = typeof cur?.temperature_2m === 'number' ? Math.round(cur.temperature_2m) : null;

      const payload = {
        city: cityLabel, // 有 city 查询时才有值，否则 null
        temperature,
        description: mapped.desc,
        icon: mapped.icon,
        lat,
        lon,
        updatedAt: new Date().toISOString(),
      };
      set(cacheKey, payload, WEATHER_TTL_MS);
      res.json({ ok: true, ...payload, cached: false });
    } catch (e) {
      console.error('[weather] 调用失败:', e.message);
      res.json({ ok: false, error: e.code || 'NETWORK_ERROR' });
    }
  }),
);

/**
 * 正向地理编码（地名 → 坐标 + 中文标签）。失败时返回 null。
 * 使用 Open-Meteo search API；按城市名 24 小时缓存避免重复请求。
 */
async function forwardGeocode(name) {
  const cacheKey = `geocode:fwd:${name}`;
  const cached = get(cacheKey);
  if (typeof cached === 'object' && cached !== null) return cached;

  const url = `${SEARCH_URL}?name=${encodeURIComponent(name)}&count=1&language=zh&format=json`;
  try {
    const r = await fetch(url);
    if (!r.ok) return null;
    const data = await r.json();
    const hit = data?.results?.[0];
    if (!hit) return null;
    const label = [hit.name, hit.admin1 && hit.admin1 !== hit.name ? hit.admin1 : null]
      .filter(Boolean)
      .join(' ');
    const payload = { latitude: hit.latitude, longitude: hit.longitude, label };
    set(cacheKey, payload, GEO_TTL_MS);
    return payload;
  } catch {
    return null;
  }
}

export default router;