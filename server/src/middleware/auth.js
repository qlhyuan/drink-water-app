import { verifyToken } from '../utils/jwt.js';
import { ApiError } from '../utils/asyncHandler.js';
import prisma from '../prisma/client.js';

export async function authMiddleware(req, _res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return next(new ApiError(401, '未登录'));
  }
  const token = header.slice(7);
  const payload = verifyToken(token);
  if (!payload?.userId) {
    return next(new ApiError(401, 'token 无效或已过期'));
  }
  const user = await prisma.user.findUnique({ where: { id: payload.userId } });
  if (!user) return next(new ApiError(401, '用户不存在'));
  req.user = user;
  next();
}

/** Optional auth: populates req.user when a valid token is present, otherwise continues. */
export async function optionalAuth(req, _res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return next();
  try {
    const payload = verifyToken(header.slice(7));
    if (payload?.userId) {
      req.user = await prisma.user.findUnique({ where: { id: payload.userId } });
    }
  } catch { /* ignore */ }
  next();
}