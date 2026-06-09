import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import Redis from 'ioredis';

import authRoutes from './routes/auth.routes.js';
import tfaRoutes from './routes/twofa.routes.js';
import courseRoutes from './routes/course.routes.js';

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

const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_SECONDS = 15 * 60;

app.use('/api/auth/login', async (req, res, next) => {
  try {
    const ip =
      req.headers['x-forwarded-for']?.toString().split(',')[0].trim() ||
      req.ip ||
      'unknown';

    const key = `rl:login:${ip}`;
    const attempts = await redis.incr(key);

    if (attempts === 1) {
      await redis.expire(key, RATE_LIMIT_WINDOW_SECONDS);
    }

    const ttl = await redis.ttl(key);

    if (attempts > RATE_LIMIT_MAX) {
      return res.status(429).json({
        error: 'Demasiados intentos. Espera 15 minutos.',
        retryAfterSeconds: ttl > 0 ? ttl : RATE_LIMIT_WINDOW_SECONDS
      });
    }

    next();
  } catch (error) {
    console.error('Rate limiter error:', error);
    return res.status(500).json({
      error: 'No se pudo validar el rate limit'
    });
  }
});

app.use('/api/auth', authRoutes);
app.use('/api/2fa', tfaRoutes);
app.use('/api/courses', courseRoutes);

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