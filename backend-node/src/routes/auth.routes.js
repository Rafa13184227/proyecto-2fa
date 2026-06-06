import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import mysql from 'mysql2/promise';
import { generateTokens, verifyRefresh } from '../utils/jwtHelper.js';
import { verifyToken } from '../middleware/verifyToken.js';

const router = express.Router();

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    waitForConnections: true
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        const [rows] = await pool.query(
            `SELECT u.*, f.secret, f.is_enabled AS twofa_enabled
       FROM users u
       LEFT JOIN user_2fa f ON f.user_id = u.id
       WHERE u.email = ? AND u.is_active = 1`,
            [email]
        );

        const user = rows[0];

        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(401).json({ error: 'Credenciales incorrectas' });
        }

        const payload = {
            sub: user.id,
            email: user.email,
            role: user.role
        };

        if (user.twofa_enabled) {
            const tempToken = jwt.sign(
                { sub: user.id, type: '2fa_pending' },
                process.env.JWT_ACCESS_SECRET,
                { expiresIn: '5m' }
            );

            return res.json({
                requires2FA: true,
                tempToken,
                message: 'Ingresa el código de tu app autenticadora'
            });
        }

        const tokens = generateTokens(payload);

        await pool.query(
            'UPDATE users SET last_login = NOW() WHERE id = ?',
            [user.id]
        );

        return res.json({
            requires2FA: false,
            ...tokens,
            user: payload
        });
    } catch (e) {
        console.error(e);
        return res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// POST /api/auth/refresh
router.post('/refresh', async (req, res) => {
    try {
        const { refreshToken } = req.body;

        if (!refreshToken) {
            return res.status(400).json({ error: 'Refresh token requerido' });
        }

        const decoded = verifyRefresh(refreshToken);

        const [rows] = await pool.query(
            'SELECT id, email, role FROM users WHERE id = ? AND is_active = 1',
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

        return res.json(tokens);
    } catch (e) {
        return res.status(401).json({ error: 'Refresh token inválido o expirado' });
    }
});

// GET /api/auth/me
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

export default router;