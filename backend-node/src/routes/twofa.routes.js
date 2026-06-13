import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import bcrypt from 'bcryptjs';
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

async function completeLoginFlow(decoded, res) {
    const tokens = generateTokens({
        sub: decoded.sub,
        email: decoded.email,
        role: decoded.role
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

    return res.json({ success: true, ...tokens });
}

router.post('/complete-login', async (req, res) => {
    try {
        const { tempToken, code } = req.body;

        const decoded = jwt.verify(tempToken, process.env.JWT_ACCESS_SECRET);

        if (decoded.type !== '2fa_pending') {
            return res.status(401).json({ error: 'Token inválido' });
        }

        const [rows] = await pool.query(
            `SELECT u.email, u.role, f.secret, f.backup_codes
       FROM users u
       JOIN user_2fa f ON f.user_id = u.id
       WHERE u.id = ? AND f.is_enabled = 1`,
            [decoded.sub]
        );

        if (!rows[0]) {
            return res.status(404).json({ error: '2FA no habilitado' });
        }

        const userData = rows[0];
        const cleanCode = String(code || '').replace(/\D/g, '');

        const totpValid = cleanCode.length === 6 && speakeasy.totp.verify({
            secret: userData.secret,
            encoding: 'base32',
            token: cleanCode,
            window: 1
        });

        if (totpValid) {
            decoded.email = userData.email;
            decoded.role = userData.role;
            return await completeLoginFlow(decoded, res);
        }

        // Try backup codes
        if (userData.backup_codes) {
            const backupCodes = typeof userData.backup_codes === 'string'
                ? JSON.parse(userData.backup_codes)
                : userData.backup_codes;
            const inputCode = String(code || '').replace(/\s/g, '').toUpperCase();

            for (let i = 0; i < backupCodes.length; i++) {
                const hash = backupCodes[i].replace(/^\$2y\$$/, '$2b$');
                if (bcrypt.compareSync(inputCode, hash)) {
                    backupCodes.splice(i, 1);
                    await pool.query(
                        'UPDATE user_2fa SET backup_codes = ? WHERE user_id = ?',
                        [JSON.stringify(backupCodes), decoded.sub]
                    );

                    decoded.email = userData.email;
                    decoded.role = userData.role;
                    return await completeLoginFlow(decoded, res);
                }
            }
        }

        return res.status(401).json({ error: 'Código incorrecto o expirado' });
    } catch (e) {
        console.error(e);
        return res.status(401).json({
            error: e.message || 'No se pudo completar el login 2FA'
        });
    }
});

export default router;