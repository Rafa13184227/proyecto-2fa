import dotenv from 'dotenv';
dotenv.config();

import jwt from 'jsonwebtoken';

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET;
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;

export const generateTokens = (payload) => ({
    accessToken: jwt.sign(payload, ACCESS_SECRET, {
        expiresIn: '15m',
        issuer: 'mi-app-2fa'
    }),
    refreshToken: jwt.sign(
        { sub: payload.sub },
        REFRESH_SECRET,
        { expiresIn: '7d' }
    )
});

export const verifyAccess = (token) => jwt.verify(token, ACCESS_SECRET);
export const verifyRefresh = (token) => jwt.verify(token, REFRESH_SECRET);