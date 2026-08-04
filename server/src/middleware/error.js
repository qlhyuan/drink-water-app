import { ZodError } from 'zod';
import { ApiError } from '../utils/asyncHandler.js';

export function notFound(_req, res) {
  res.status(404).json({ error: '接口不存在' });
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, _req, res, _next) {
  if (err instanceof ApiError) {
    return res.status(err.status).json({ error: err.message, details: err.details });
  }
  if (err instanceof ZodError) {
    return res.status(400).json({ error: '参数校验失败', details: err.flatten() });
  }
  console.error('[unhandled]', err);
  res.status(500).json({ error: '服务器内部错误' });
}