import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import mysql from 'mysql2/promise';
import crypto from 'crypto';
import { generateTokens, verifyRefresh } from '../utils/jwtHelper.js';
import { verifyToken } from '../middleware/verifyToken.js';

const router = express.Router();

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    waitForConnections: true
});

const hashToken = (token) =>
    crypto.createHash('sha256').update(token).digest('hex');

router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        const [rows] = await pool.query(
            `SELECT
        u.id,
        u.name,
        u.email,
        u.password,
        u.role,
        u.is_active,
        COALESCE(f.secret, NULL) AS secret,
        COALESCE(f.is_enabled, 0) AS twofa_enabled
      FROM users u
      LEFT JOIN user_2fa f ON f.user_id = u.id
      WHERE u.email = ? AND u.is_active = 1`,
            [email]
        );

        const user = rows[0];

        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(401).json({ error: 'Credenciales incorrectas' });
        }

        if (Number(user.twofa_enabled) === 1) {
            const tempToken = jwt.sign(
                { sub: user.id, type: '2fa_pending' },
                process.env.JWT_ACCESS_SECRET,
                { expiresIn: '5m' }
            );

            const ip = req.ip || req.connection?.remoteAddress || 'unknown';
            req.redis?.del(`rl:login:${ip}`);

            return res.json({
                requires2FA: true,
                tempToken,
                message: 'Ingresa el código de tu app autenticadora'
            });
        }

        const tokens = generateTokens({
            sub: user.id,
            email: user.email,
            role: user.role
        });

        const refreshHash = hashToken(tokens.refreshToken);
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

        await pool.query(
            `INSERT INTO refresh_tokens (user_id, token_hash, expires_at, revoked)
       VALUES (?, ?, ?, 0)`,
            [user.id, refreshHash, expiresAt]
        );

        await pool.query(
            'UPDATE users SET last_login = NOW() WHERE id = ?',
            [user.id]
        );

        const ip = req.ip || req.connection?.remoteAddress || 'unknown';
        req.redis?.del(`rl:login:${ip}`);

        return res.json({
            requires2FA: false,
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
            user: {
                sub: user.id,
                email: user.email,
                role: user.role
            }
        });
    } catch (e) {
        console.error(e);
        return res.status(500).json({ error: 'Error interno del servidor' });
    }
});

router.post('/refresh', async (req, res) => {
    try {
        const { refreshToken } = req.body;

        if (!refreshToken) {
            return res.status(400).json({ error: 'Refresh token requerido' });
        }

        const decoded = verifyRefresh(refreshToken);
        const tokenHash = hashToken(refreshToken);

        const [stored] = await pool.query(
            `SELECT id, user_id, revoked, expires_at
       FROM refresh_tokens
       WHERE token_hash = ? AND user_id = ?`,
            [tokenHash, decoded.sub]
        );

        const current = stored[0];

        if (!current || current.revoked) {
            return res.status(401).json({ error: 'Refresh token inválido o revocado' });
        }

        if (new Date(current.expires_at).getTime() <= Date.now()) {
            return res.status(401).json({ error: 'Refresh token expirado' });
        }

        const [rows] = await pool.query(
            'SELECT id, name, email, role FROM users WHERE id = ? AND is_active = 1',
            [decoded.sub]
        );

        if (!rows[0]) {
            return res.status(401).json({ error: 'Usuario no encontrado' });
        }

        const tokens = generateTokens({
            sub: rows[0].id,
            email: rows[0].email,
            role: rows[0].role
        });

        await pool.query(
            'UPDATE refresh_tokens SET revoked = 1 WHERE id = ?',
            [current.id]
        );

        const newHash = hashToken(tokens.refreshToken);
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

        await pool.query(
            `INSERT INTO refresh_tokens (user_id, token_hash, expires_at, revoked)
       VALUES (?, ?, ?, 0)`,
            [rows[0].id, newHash, expiresAt]
        );

        return res.json(tokens);
    } catch (e) {
        return res.status(401).json({ error: 'Refresh token inválido o expirado' });
    }
});

router.get('/me', verifyToken, async (req, res) => {
    try {
        const [rows] = await pool.query(
            'SELECT id, name, email, role, last_login FROM users WHERE id = ? AND is_active = 1',
            [req.user.sub]
        );

        if (!rows[0]) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }

        return res.json({
            user: rows[0]
        });
    } catch (e) {
        console.error(e);
        return res.status(500).json({ error: 'Error interno del servidor' });
    }
});

export async function persistRefreshToken(userId, refreshToken) {
    const tokenHash = hashToken(refreshToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await pool.query(
        `INSERT INTO refresh_tokens (user_id, token_hash, expires_at, revoked)
     VALUES (?, ?, ?, 0)`,
        [userId, tokenHash, expiresAt]
    );
}

export default router;