<?php

declare(strict_types=1);

use Firebase\JWT\JWT;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use RobThree\Auth\Providers\Qr\QRServerProvider;
use RobThree\Auth\TwoFactorAuth;

class AuthController
{
    private TwoFactorAuth $tfa;

    public function __construct()
    {
        $this->tfa = new TwoFactorAuth(
            new QRServerProvider(),
            'MiApp 2FA'
        );
    }

    public function register(Request $req, Response $res): Response
    {
        $body = $req->getParsedBody();

        $name = trim($body['name'] ?? '');
        $email = trim($body['email'] ?? '');
        $pass = $body['password'] ?? '';

        if ($name === '') {
            return $this->json($res, ['error' => 'El nombre es obligatorio'], 400);
        }

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

        $db->beginTransaction();

        try {
            $insert = $db->prepare(
                'INSERT INTO users (name, email, password) VALUES (?, ?, ?)'
            );
            $insert->execute([$name, $email, $hash]);

            $userId = (int)$db->lastInsertId();
            $secret = $this->tfa->createSecret();

            $insert2fa = $db->prepare(
                'INSERT INTO user_2fa (user_id, secret, is_enabled) VALUES (?, ?, 0)'
            );
            $insert2fa->execute([$userId, $secret]);

            $qrCodeUri = $this->tfa->getQRCodeImageAsDataUri($email, $secret, 200);

            $db->commit();

            return $this->json($res, [
                'message' => 'Usuario creado exitosamente',
                'userId' => $userId,
                'requires2FASetup' => true,
                'secret' => $secret,
                'qrCodeUri' => $qrCodeUri
            ], 201);
        } catch (Throwable $e) {
            if ($db->inTransaction()) {
                $db->rollBack();
            }

            return $this->json($res, ['error' => 'No se pudo registrar el usuario'], 500);
        }
    }

    public function login(Request $req, Response $res): Response
    {
        $body = $req->getParsedBody();

        $email = trim($body['email'] ?? '');
        $pass = $body['password'] ?? '';

        $db = Database::getInstance();

        $stmt = $db->prepare(
            'SELECT u.*, t.secret, t.is_enabled AS twofa_enabled
             FROM users u
             LEFT JOIN user_2fa t ON t.user_id = u.id
             WHERE u.email = ? AND u.is_active = 1'
        );
        $stmt->execute([$email]);
        $user = $stmt->fetch();

        if (!$user || !password_verify($pass, $user['password'])) {
            return $this->json($res, ['error' => 'Credenciales incorrectas'], 401);
        }

        if (empty($user['secret'])) {
            return $this->json($res, ['error' => 'El usuario no tiene 2FA configurado'], 403);
        }

        return $this->json($res, [
            'requires2FA' => true,
            'tempToken' => $this->generateTempToken((int)$user['id']),
            'userId' => (int)$user['id']
        ]);
    }

    public function logout(Request $req, Response $res): Response
    {
        $body = $req->getParsedBody() ?? [];
        $refreshToken = trim($body['refreshToken'] ?? '');
        $userId = (int)$req->getAttribute('userId');

        if ($refreshToken === '') {
            return $this->json($res, ['error' => 'Refresh token requerido'], 400);
        }

        $tokenHash = hash('sha256', $refreshToken);
        $db = Database::getInstance();

        $stmt = $db->prepare(
            'UPDATE refresh_tokens
             SET revoked = 1
             WHERE user_id = ? AND token_hash = ?'
        );
        $stmt->execute([$userId, $tokenHash]);

        return $this->json($res, [
            'message' => 'Logout exitoso'
        ]);
    }

    private function generateTempToken(int $userId): string
    {
        $payload = [
            'sub' => $userId,
            'type' => '2fa_pending',
            'exp' => time() + 300
        ];

        return JWT::encode($payload, $_ENV['JWT_SECRET'], 'HS256');
    }

    private function json(Response $res, array $data, int $code = 200): Response
    {
        $res->getBody()->write(json_encode($data));

        return $res
            ->withHeader('Content-Type', 'application/json')
            ->withStatus($code);
    }
}
