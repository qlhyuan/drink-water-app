import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

import authRoutes from './routes/auth.js';
import userRoutes from './routes/user.js';
import recordRoutes from './routes/records.js';
import statsRoutes from './routes/stats.js';
import cupRoutes from './routes/cups.js';
import reminderRoutes from './routes/reminders.js';
import feishuRoutes from './routes/feishu.js';
import quickRecordRoutes from './routes/quickRecord.js';
import { notFound, errorHandler } from './middleware/error.js';
import { bootstrapAdmin } from './bootstrap.js';
import { startReminderWorker } from './reminder-worker.js';
import { startFeishuEventListener, stopFeishuEventListener } from './routes/feishuEvent.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = Number(process.env.PORT) || 3001;

app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: '64kb' }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

const origins = (process.env.CORS_ORIGIN || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
app.use(
  cors({
    origin: origins.length ? origins : true,
    credentials: true,
  }),
);

const limiter = rateLimit({ windowMs: 60_000, max: 240 });
app.use('/api', limiter);

// 健康检查
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/records', recordRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/cups', cupRoutes);
app.use('/api/reminders', reminderRoutes);
app.use('/api/feishu', feishuRoutes);
app.use('/api/quick-record', rateLimit({ windowMs: 60_000, max: 60 }), quickRecordRoutes);

// 可选：托管前端构建产物（同步判断，确保 listen 前已挂载）
const webDist = path.resolve(__dirname, '../../web/dist');
if (fs.existsSync(webDist)) {
  app.use(express.static(webDist));
  app.get(/^(?!\/api\/).*/, (req, res) => {
    res.sendFile(path.join(webDist, 'index.html'));
  });
  console.log(`[server] static files from ${webDist}`);
}

app.use(notFound);
app.use(errorHandler);

// 先创建管理员账号（如配置了 ADMIN_*），再监听端口，避免启动瞬间登录请求抢跑
bootstrapAdmin()
  .catch((e) => {
    console.error('[bootstrap] 创建管理员账号失败:', e.message);
  })
  .finally(() => {
    startReminderWorker();
    startFeishuEventListener(); // 启动飞书长连接（监听卡片点击）
    app.listen(PORT, () => {
      console.log(`[server] listening on http://localhost:${PORT}`);
    });
  });

// 优雅退出
const shutdown = (signal) => {
  console.log(`[server] 收到 ${signal}，开始优雅退出`);
  stopFeishuEventListener();
  process.exit(0);
};
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));