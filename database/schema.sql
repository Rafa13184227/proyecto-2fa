-- =========================================================
-- Sistema 2FA + Cursos
-- database/schema.sql
-- =========================================================
CREATE DATABASE IF NOT EXISTS auth_2fa_db CHARACTER
SET
    utf8mb4 COLLATE utf8mb4_unicode_ci;

USE auth_2fa_db;

-- ---------------------------------------------------------
-- Tabla de usuarios
-- ---------------------------------------------------------
CREATE TABLE
    IF NOT EXISTS users (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(150) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        role ENUM ('user', 'admin') NOT NULL DEFAULT 'user',
        is_active TINYINT (1) NOT NULL DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        last_login TIMESTAMP NULL
    ) ENGINE = InnoDB;

-- ---------------------------------------------------------
-- Configuración 2FA
-- ---------------------------------------------------------
CREATE TABLE
    IF NOT EXISTS user_2fa (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        user_id INT UNSIGNED NOT NULL UNIQUE,
        secret VARCHAR(64) NOT NULL,
        is_enabled TINYINT (1) NOT NULL DEFAULT 0,
        backup_codes JSON NULL,
        verified_at TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_user_2fa_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    ) ENGINE = InnoDB;

-- ---------------------------------------------------------
-- Tokens de refresh
-- ---------------------------------------------------------
CREATE TABLE
    IF NOT EXISTS refresh_tokens (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        user_id INT UNSIGNED NOT NULL,
        token_hash VARCHAR(255) NOT NULL UNIQUE,
        expires_at TIMESTAMP NOT NULL,
        revoked TINYINT (1) NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_refresh_tokens_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    ) ENGINE = InnoDB;

-- ---------------------------------------------------------
-- Logs de autenticación
-- ---------------------------------------------------------
CREATE TABLE
    IF NOT EXISTS auth_logs (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        user_id INT UNSIGNED NULL,
        action VARCHAR(50) NOT NULL,
        ip_address VARCHAR(45) NULL,
        user_agent TEXT NULL,
        success TINYINT (1) NOT NULL DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_auth_logs_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL
    ) ENGINE = InnoDB;

-- ---------------------------------------------------------
-- Cursos
-- ---------------------------------------------------------
CREATE TABLE
    IF NOT EXISTS courses (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(150) NOT NULL,
        code VARCHAR(50) NOT NULL UNIQUE,
        credits INT NOT NULL DEFAULT 1,
        teacher_id INT UNSIGNED NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        KEY idx_courses_teacher (teacher_id),
        CONSTRAINT fk_courses_teacher FOREIGN KEY (teacher_id) REFERENCES users (id) ON DELETE SET NULL
    ) ENGINE = InnoDB;

-- ---------------------------------------------------------
-- Matrículas / asignaciones
-- ---------------------------------------------------------
CREATE TABLE
    IF NOT EXISTS enrollments (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        student_id INT UNSIGNED NOT NULL,
        course_id INT UNSIGNED NOT NULL,
        grade DECIMAL(5, 2) NULL,
        enrolled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_student_course (student_id, course_id),
        KEY idx_enrollments_student (student_id),
        KEY idx_enrollments_course (course_id),
        CONSTRAINT fk_enrollments_student FOREIGN KEY (student_id) REFERENCES users (id) ON DELETE CASCADE,
        CONSTRAINT fk_enrollments_course FOREIGN KEY (course_id) REFERENCES courses (id) ON DELETE CASCADE
    ) ENGINE = InnoDB;

-- ---------------------------------------------------------
-- Usuario admin de prueba
-- password: Admin123!
-- ---------------------------------------------------------
INSERT INTO
    users (name, email, password, role, is_active)
VALUES
    (
        'Administrador',
        'admin@test.com',
        '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4oK6BbqXGa',
        'admin',
        1
    ) ON DUPLICATE KEY
UPDATE email = email;