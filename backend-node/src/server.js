import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import Redis from 'ioredis';

import authRoutes from './routes/auth.routes.js';
import tfaRoutes from './routes/twofa.routes.js';
import courseRoutes from './routes/course.routes.js';
import adminRoutes from './routes/admin.routes.js';

dotenv.config();

const app = express();

const redis = new Redis(process.env.REDIS_URL || 'redis://127.0.0.1:6379', {
  maxRetriesPerRequest: 2,
  enableReadyCheck: true
});

redis.on('connect', () => {
  console.log('✅ Redis conectado');
});

redis.on('error', (err) => {
  console.error('❌ Error Redis:', err.message);
});

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:4200',
  credentials: true
}));

app.use(express.json());

// Rate limiter para login (Redis-based)
const loginRateLimiter = async (req, res, next) => {
  try {
    const ip = req.ip || req.connection?.remoteAddress || 'unknown';
    const key = `rl:login:${ip}`;
    const current = await redis.incr(key);
    if (current === 1) {
      await redis.expire(key, 900);
    }
    if (current > 5) {
      return res.status(429).json({ error: 'Demasiados intentos. Intenta de nuevo en 15 minutos.' });
    }
    next();
  } catch {
    next();
  }
};

app.use('/api/auth/login', loginRateLimiter);

app.use('/api/auth', (req, res, next) => {
  req.redis = redis;
  next();
}, authRoutes);

app.use('/api/2fa', tfaRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/admin', adminRoutes);

app.get('/health', async (_, res) => {
  let redisStatus = 'disconnected';

  try {
    const pong = await redis.ping();
    redisStatus = pong === 'PONG' ? 'ok' : 'error';
  } catch {
    redisStatus = 'error';
  }

  return res.json({
    status: 'ok',
    redis: redisStatus
  });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 Node API corriendo en http://localhost:${PORT}`);
});