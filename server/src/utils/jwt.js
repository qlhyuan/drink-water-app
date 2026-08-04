import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// 旧文档/镜像里出现过的占位默认值，视为“未配置”
const PLACEHOLDER_SECRETS = new Set([
  'please-change-me-in-production',
  'change-me-in-production',
  'drink-water-dev-secret',
]);

function resolveSecret() {
  const fromEnv = process.env.JWT_SECRET;
  if (fromEnv && !PLACEHOLDER_SECRETS.has(fromEnv.trim())) {
    return fromEnv.trim();
  }

  // 未配置（或仍是占位值）→ 自动生成一个强随机密钥，并持久化到 data/.jwt-secret，
  // 这样容器重启 / 重新部署后已签发的 token 依然有效。
  const dataDir = path.resolve(__dirname, '../../data');
  const secretFile = path.join(dataDir, '.jwt-secret');
  try {
    fs.mkdirSync(dataDir, { recursive: true });
    if (fs.existsSync(secretFile)) {
      const saved = fs.readFileSync(secretFile, 'utf8').trim();
      if (saved) return saved;
    }
    const generated = crypto.randomBytes(32).toString('hex');
    fs.writeFileSync(secretFile, generated, { mode: 0o600 });
    console.log('[jwt] 未配置 JWT_SECRET，已自动生成并保存到 data/.jwt-secret');
    return generated;
  } catch (e) {
    console.warn(
      `[jwt] 自动生成密钥失败（${e.message}），使用随机临时密钥，重启后已签发 token 将失效`,
    );
    return crypto.randomBytes(32).toString('hex');
  }
}

const SECRET = resolveSecret();
const EXPIRES = process.env.JWT_EXPIRES_IN || '7d';

export function signToken(payload) {
  return jwt.sign(payload, SECRET, { expiresIn: EXPIRES });
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, SECRET);
  } catch {
    return null;
  }
}
