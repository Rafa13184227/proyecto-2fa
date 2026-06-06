import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

import authRoutes from './routes/auth.routes.js';
import tfaRoutes from './routes/twofa.routes.js';
import adminRoutes from './routes/admin.routes.js';
import courseRoutes from './routes/course.routes.js';

dotenv.config();

const app = express();

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:4200',
  credentials: true
}));

app.use(express.json());

const loginAttempts = new Map();

app.use('/api/auth/login', (req, res, next) => {
  const ip = req.ip;
  const data = loginAttempts.get(ip) || { count: 0, time: Date.now() };

  if (Date.now() - data.time > 15 * 60 * 1000) {
    loginAttempts.delete(ip);
  }

  const current = loginAttempts.get(ip) || { count: 0, time: Date.now() };

  if (current.count >= 5) {
    return res.status(429).json({
      error: 'Demasiados intentos. Espera 15 minutos.'
    });
  }

  loginAttempts.set(ip, {
    count: current.count + 1,
    time: current.time
  });

  next();
});

app.use('/api/auth', authRoutes);
app.use('/api/2fa', tfaRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/courses', courseRoutes);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 Node API corriendo en http://localhost:${PORT}`);
});