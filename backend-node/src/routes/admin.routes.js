import express from 'express';
import bcrypt from 'bcryptjs';
import pool from '../db/pool.js';
import { verifyToken } from '../middleware/verifyToken.js';
import { verifyAdmin } from '../middleware/verifyAdmin.js';

const router = express.Router();

router.use(verifyToken, verifyAdmin);

// GET /api/admin/students
router.get('/students', async (_req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT id, name, email, role, is_active, created_at
      FROM users
      WHERE role = 'user'
      ORDER BY id DESC
    `);

    return res.json({ students: rows });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Error al obtener estudiantes' });
  }
});

// GET /api/admin/courses
router.get('/courses', async (_req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT id, name, code, credits, teacher_id, created_at
      FROM courses
      ORDER BY id DESC
    `);

    return res.json({ courses: rows });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Error al obtener cursos' });
  }
});

// POST /api/admin/users
router.post('/users', async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    if (!name?.trim()) {
      return res.status(400).json({ error: 'El nombre es obligatorio' });
    }

    if (!email?.trim()) {
      return res.status(400).json({ error: 'El correo es obligatorio' });
    }

    if (!password || password.length < 8) {
      return res.status(400).json({ error: 'La contraseña debe tener mínimo 8 caracteres' });
    }

    if (!['user', 'admin'].includes(role)) {
      return res.status(400).json({ error: 'Rol inválido' });
    }

    const [existing] = await pool.query(
      'SELECT id FROM users WHERE email = ? LIMIT 1',
      [email.trim()]
    );

    if (existing.length > 0) {
      return res.status(409).json({ error: 'Ya existe un usuario con ese correo' });
    }

    const hash = await bcrypt.hash(password, 12);

    const [result] = await pool.query(
      `INSERT INTO users (name, email, password, role, is_active)
       VALUES (?, ?, ?, ?, 1)`,
      [name.trim(), email.trim(), hash, role]
    );

    return res.status(201).json({
      message: 'Usuario creado correctamente',
      userId: result.insertId
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Error al crear usuario' });
  }
});

// POST /api/admin/courses
router.post('/courses', async (req, res) => {
  try {
    const { name, code, credits, teacher_id } = req.body;

    if (!name?.trim()) {
      return res.status(400).json({ error: 'El nombre del curso es obligatorio' });
    }

    if (!code?.trim()) {
      return res.status(400).json({ error: 'El código del curso es obligatorio' });
    }

    if (!credits || Number(credits) < 1) {
      return res.status(400).json({ error: 'Los créditos deben ser mayores a 0' });
    }

    const [existing] = await pool.query(
      'SELECT id FROM courses WHERE code = ? LIMIT 1',
      [code.trim()]
    );

    if (existing.length > 0) {
      return res.status(409).json({ error: 'Ya existe un curso con ese código' });
    }

    const teacherIdValue = teacher_id ? Number(teacher_id) : null;

    const [result] = await pool.query(
      `INSERT INTO courses (name, code, credits, teacher_id)
       VALUES (?, ?, ?, ?)`,
      [name.trim(), code.trim(), Number(credits), teacherIdValue]
    );

    return res.status(201).json({
      message: 'Curso creado correctamente',
      courseId: result.insertId
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Error al crear curso' });
  }
});

// POST /api/admin/assignments
router.post('/assignments', async (req, res) => {
  try {
    const { student_id, course_id } = req.body;

    if (!student_id || !course_id) {
      return res.status(400).json({ error: 'student_id y course_id son obligatorios' });
    }

    const [[student]] = await pool.query(
      `SELECT id
       FROM users
       WHERE id = ? AND role = 'user' AND is_active = 1
       LIMIT 1`,
      [student_id]
    );

    if (!student) {
      return res.status(404).json({ error: 'Estudiante no encontrado' });
    }

    const [[course]] = await pool.query(
      `SELECT id
       FROM courses
       WHERE id = ?
       LIMIT 1`,
      [course_id]
    );

    if (!course) {
      return res.status(404).json({ error: 'Curso no encontrado' });
    }

    const [existing] = await pool.query(
      `SELECT id
       FROM enrollments
       WHERE student_id = ? AND course_id = ?
       LIMIT 1`,
      [student_id, course_id]
    );

    if (existing.length > 0) {
      return res.status(409).json({ error: 'El estudiante ya está asignado a ese curso' });
    }

    const [result] = await pool.query(
      `INSERT INTO enrollments (student_id, course_id, enrolled_at)
       VALUES (?, ?, NOW())`,
      [student_id, course_id]
    );

    return res.status(201).json({
      message: 'Curso asignado correctamente',
      enrollmentId: result.insertId
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Error al asignar curso' });
  }
});

export default router;