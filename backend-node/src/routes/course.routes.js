import express from 'express';
import mysql from 'mysql2/promise';
import { verifyToken } from '../middleware/verifyToken.js';

const router = express.Router();

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    waitForConnections: true
});

router.get('/my-courses', verifyToken, async (req, res) => {
    try {
        const userId = req.user.sub;

        const [rows] = await pool.query(
            `SELECT
         c.id,
         c.name,
         c.code,
         c.credits,
         e.grade,
         e.enrolled_at
       FROM enrollments e
       INNER JOIN courses c ON c.id = e.course_id
       WHERE e.student_id = ?
       ORDER BY e.enrolled_at DESC, c.name ASC`,
            [userId]
        );

        return res.json({ courses: rows });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            error: 'Error al obtener los cursos del usuario'
        });
    }
});

export default router;