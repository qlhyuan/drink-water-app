/**
 * /api/geo/ip
 *  - 用客户端 IP 反查大致城市（ip-api.com 免费服务）
 *  - 后端代理，避免前端 CORS / HTTPS 混合内容问题
 *  - 缓存 1 小时（同 IP 不会频繁查询）
 *
 * 替代方案（如需更准）：
 *  - 高德 IP 定位（需 Key，免费配额 5000/天）：https://lbs.amap.com/api/webservice/guide/api/ipconfig
 *  - ipapi.co（HTTPS，免费 1000/天）：https://ipapi.co/json/
 */
import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { authMiddleware } from '../middleware/auth.js';
import { get, set } from '../ai/cache.js';

const router = Router();
router.use(authMiddleware);

const IP_API_URL = 'http://ip-api.com/json/?lang=zh-CN&fields=status,message,country,regionName,city,lat,lon,timezone';
const TTL_MS = 60 * 60 * 1000; // 1 小时
const TIMEOUT_MS = 4000; // 4 秒超时（IP 服务可能较慢）

/**
 * GET /api/geo/ip
 *  - 返回 { ok, city, region, country, lat, lon, timezone, ... }
 *  - 失败返回 { ok: false, error }（前端 fallback 到默认城市）
 */
router.get(
  '/ip',
  asyncHandler(async (req, res) => {
    // 客户端真实 IP（处理反代场景）
    const xff = req.headers['x-forwarded-for'];
    const clientIp = req.ip
      || (typeof xff === 'string' ? xff.split(',')[0].trim() : null)
      || req.socket?.remoteAddress
      || 'unknown';

    // 缓存（同 IP 不重复查询）
    const cacheKey = `geo:ip:${clientIp}`;
    const cached = get(cacheKey);
    if (cached) return res.json({ ok: true, ...cached, cached: true });

    // 用 AbortController 控制超时
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);

    try {
      const r = await fetch(IP_API_URL, { signal: ctrl.signal });
      clearTimeout(timer);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      if (data?.status !== 'success') {
        throw new Error(data?.message || 'IP API returned non-success');
      }

      const payload = {
        ip: clientIp,
        city: data.city || null,
        region: data.regionName || null,
        country: data.country || null,
        lat: typeof data.lat === 'number' ? data.lat : null,
        lon: typeof data.lon === 'number' ? data.lon : null,
        timezone: data.timezone || null,
      };
      set(cacheKey, payload, TTL_MS);
      res.json({ ok: true, ...payload, cached: false });
    } catch (e) {
      clearTimeout(timer);
      const reason = e.name === 'AbortError' ? 'TIMEOUT' : 'IP_API_FAILED';
      console.warn(`[geo] IP 定位失败: ${reason} (${e.message})`);
      res.json({ ok: false, error: reason, message: e.message });
    }
  }),
);

export default router;