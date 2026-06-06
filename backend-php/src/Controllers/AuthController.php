<?php
declare(strict_types=1);

use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;

class AuthController
{
    /** POST /api/auth/register */
    public function register(Request $req, Response $res): Response
    {
        $body = $req->getParsedBody();
        $name = trim($body['name'] ?? '');
        $email = trim($body['email'] ?? '');
        $pass = $body['password'] ?? '';

        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            return $this->json($res, ['error' => 'Email inválido'], 400);
        }

        if (strlen($pass) < 8) {
            return $this->json($res, ['error' => 'Mínimo 8 caracteres'], 400);
        }

        $db = Database::getInstance();

        $stmt = $db->prepare('SELECT id FROM users WHERE email = ?');
        $stmt->execute([$email]);

        if ($stmt->fetch()) {
            return $this->json($res, ['error' => 'El email ya está registrado'], 409);
        }

        $hash = password_hash($pass, PASSWORD_BCRYPT, ['cost' => 12]);

        $insert = $db->prepare('INSERT INTO users (name, email, password) VALUES (?, ?, ?)');
        $insert->execute([$name, $email, $hash]);

        $userId = $db->lastInsertId();

        return $this->json($res, [
            'message' => 'Usuario creado exitosamente',
            'userId' => (int)$userId
        ], 201);
    }

    /** POST /api/auth/login */
    public function login(Request $req, Response $res): Response
    {
        $body = $req->getParsedBody();
        $email = trim($body['email'] ?? '');
        $pass = $body['password'] ?? '';

        $db = Database::getInstance();
        $stmt = $db->prepare(
            'SELECT u.*, t.secret, t.is_enabled as twofa_enabled
             FROM users u
             LEFT JOIN user_2fa t ON t.user_id = u.id
             WHERE u.email = ? AND u.is_active = 1'
        );
        $stmt->execute([$email]);
        $user = $stmt->fetch();

        if (!$user || !password_verify($pass, $user['password'])) {
            return $this->json($res, ['error' => 'Credenciales incorrectas'], 401);
        }

        if ($user['twofa_enabled']) {
            return $this->json($res, [
                'requires2FA' => true,
                'tempToken' => $this->generateTempToken((int)$user['id']),
                'userId' => (int)$user['id']
            ]);
        }

        return $this->json($res, [
            'requires2FA' => false,
            'user' => [
                'id' => (int)$user['id'],
                'name' => $user['name'],
                'email' => $user['email'],
                'role' => $user['role']
            ]
        ]);
    }

    private function generateTempToken(int $userId): string
    {
        $payload = [
            'sub' => $userId,
            'type' => '2fa_pending',
            'exp' => time() + 300
        ];

        return \Firebase\JWT\JWT::encode($payload, getenv('JWT_SECRET'), 'HS256');
    }

    private function json(Response $res, array $data, int $code = 200): Response
    {
        $res->getBody()->write(json_encode($data));
        return $res
            ->withHeader('Content-Type', 'application/json')
            ->withStatus($code);
    }
}