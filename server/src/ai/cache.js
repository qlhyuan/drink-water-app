/**
 * 极简内存缓存：按 key 缓存 value，TTL 过期。
 * 仅用于进程内、单实例场景；多实例部署需替换为 Redis。
 */

/** @type {Map<string, { value: any, expireAt: number }>} */
const store = new Map();

/**
 * 获取缓存；命中且未过期则返回值，否则返回 null。
 */
export function get(key) {
  const entry = store.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expireAt) {
    store.delete(key);
    return null;
  }
  return entry.value;
}

/**
 * 写入缓存，ttl 单位毫秒。
 */
export function set(key, value, ttlMs = 60_000) {
  store.set(key, { value, expireAt: Date.now() + ttlMs });
}

/** 定期清理过期条目，避免内存无限增长 */
const SWEEP_INTERVAL = 5 * 60_000;
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of store) {
    if (now > v.expireAt) store.delete(k);
  }
}, SWEEP_INTERVAL).unref?.();