import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import jwt from 'jsonwebtoken';
import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import mysql from 'mysql2/promise';
import crypto from 'crypto';
import { verifyToken } from '../middleware/verifyToken.js';
import { generateTokens } from '../utils/jwtHelper.js';

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

router.post('/setup', verifyToken, async (req, res) => {
    try {
        const userId = req.user.sub;
        const email = req.user.email;

        const secret = speakeasy.generateSecret({
            name: `MiApp (${email})`,
            length: 20
        });

        await pool.query(
            `INSERT INTO user_2fa (user_id, secret, is_enabled)
       VALUES (?, ?, 0)
       ON DUPLICATE KEY UPDATE secret = ?, is_enabled = 0`,
            [userId, secret.base32, secret.base32]
        );

        const qrCodeUri = await QRCode.toDataURL(secret.otpauth_url);

        return res.json({
            secret: secret.base32,
            qrCodeUri
        });
    } catch (e) {
        console.error(e);
        return res.status(500).json({
            error: 'Error al generar la configuración 2FA'
        });
    }
});

router.post('/verify', verifyToken, async (req, res) => {
    try {
        const userId = req.user.sub;
        const code = String(req.body.code || '').replace(/\D/g, '');

        const [rows] = await pool.query(
            'SELECT secret FROM user_2fa WHERE user_id = ?',
            [userId]
        );

        if (!rows[0]) {
            return res.status(404).json({ error: '2FA no configurado' });
        }

        const valid = speakeasy.totp.verify({
            secret: rows[0].secret,
            encoding: 'base32',
            token: code,
            window: 1
        });

        if (!valid) {
            return res.status(401).json({ error: 'Código incorrecto o expirado' });
        }

        await pool.query(
            'UPDATE user_2fa SET is_enabled = 1, verified_at = NOW() WHERE user_id = ?',
            [userId]
        );

        return res.json({
            verified: true,
            message: '2FA activado correctamente'
        });
    } catch (e) {
        console.error(e);
        return res.status(500).json({
            error: 'Error al verificar 2FA'
        });
    }
});

router.post('/complete-login', async (req, res) => {
    try {
        const { tempToken, code } = req.body;

        const decoded = jwt.verify(tempToken, process.env.JWT_ACCESS_SECRET);

        if (decoded.type !== '2fa_pending') {
            return res.status(401).json({ error: 'Token inválido' });
        }

        const [rows] = await pool.query(
            `SELECT u.email, u.role, f.secret
       FROM users u
       JOIN user_2fa f ON f.user_id = u.id
       WHERE u.id = ? AND f.is_enabled = 1`,
            [decoded.sub]
        );

        if (!rows[0]) {
            return res.status(404).json({ error: '2FA no habilitado' });
        }

        const valid = speakeasy.totp.verify({
            secret: rows[0].secret,
            encoding: 'base32',
            token: String(code || '').replace(/\D/g, ''),
            window: 1
        });

        if (!valid) {
            return res.status(401).json({ error: 'Código incorrecto o expirado' });
        }

        const tokens = generateTokens({
            sub: decoded.sub,
            email: rows[0].email,
            role: rows[0].role
        });

        const refreshHash = hashToken(tokens.refreshToken);
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

        await pool.query(
            `INSERT INTO refresh_tokens (user_id, token_hash, expires_at, revoked)
       VALUES (?, ?, ?, 0)`,
            [decoded.sub, refreshHash, expiresAt]
        );

        await pool.query(
            'UPDATE users SET last_login = NOW() WHERE id = ?',
            [decoded.sub]
        );

        return res.json({
            success: true,
            ...tokens
        });
    } catch (e) {
        console.error(e);
        return res.status(401).json({
            error: e.message || 'No se pudo completar el login 2FA'
        });
    }
});

export default router;