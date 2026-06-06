import { verifyAccess } from '../utils/jwtHelper.js';

export const verifyToken = (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Token requerido' });
    }

    try {
        const token = authHeader.slice(7);
        const decoded = verifyAccess(token);
        req.user = decoded;
        next();
    } catch (e) {
        const msg = e.name === 'TokenExpiredError'
            ? 'Token expirado'
            : 'Token inválido';

        return res.status(401).json({ error: msg });
    }
};