<?php

declare(strict_types=1);

use PDO;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use RobThree\Auth\Providers\Qr\QRServerProvider;
use RobThree\Auth\TwoFactorAuth;

class TwoFAController
{
    private TwoFactorAuth $tfa;

    public function __construct()
    {
        $this->tfa = new TwoFactorAuth(
            new QRServerProvider(),
            'MiApp 2FA'
        );
    }

    public function setup(Request $req, Response $res): Response
    {
        $userId = (int)$req->getAttribute('userId');
        $db = Database::getInstance();

        $stmt = $db->prepare('SELECT email FROM users WHERE id = ?');
        $stmt->execute([$userId]);
        $user = $stmt->fetch();

        if (!$user) {
            return $this->json($res, ['error' => 'Usuario no encontrado'], 404);
        }

        $secret = $this->tfa->createSecret();

        $upsert = $db->prepare(
            'INSERT INTO user_2fa (user_id, secret, is_enabled)
             VALUES (?, ?, 0)
             ON DUPLICATE KEY UPDATE secret = ?, is_enabled = 0'
        );
        $upsert->execute([$userId, $secret, $secret]);

        $otpUri = $this->tfa->getQRCodeImageAsDataUri(
            $user['email'],
            $secret,
            200
        );

        return $this->json($res, [
            'secret' => $secret,
            'qrCodeUri' => $otpUri
        ]);
    }

    public function verify(Request $req, Response $res): Response
    {
        $body = $req->getParsedBody() ?? [];
        $userId = (int)$req->getAttribute('userId');
        $code = strtoupper(trim((string)($body['code'] ?? '')));

        if ($code === '') {
            return $this->json($res, ['error' => 'Código requerido'], 400);
        }

        $db = Database::getInstance();

        $stmt = $db->prepare(
            'SELECT secret, backup_codes
             FROM user_2fa
             WHERE user_id = ?'
        );
        $stmt->execute([$userId]);
        $record = $stmt->fetch();

        if (!$record) {
            return $this->json($res, ['error' => '2FA no configurado'], 404);
        }

        $numericCode = preg_replace('/\D/', '', $code);

        if (strlen($numericCode) === 6) {
            $isValidTotp = $this->tfa->verifyCode($record['secret'], $numericCode, 1);

            if ($isValidTotp) {
                $db->prepare(
                    'UPDATE user_2fa
                     SET is_enabled = 1, verified_at = NOW()
                     WHERE user_id = ?'
                )->execute([$userId]);

                $this->logAction($db, $userId, '2fa_ok', true);

                return $this->json($res, [
                    'verified' => true,
                    'method' => 'totp'
                ]);
            }
        }

        $backupResult = $this->consumeBackupCode($db, $userId, $code, $record['backup_codes']);

        if ($backupResult) {
            $db->prepare(
                'UPDATE user_2fa
                 SET is_enabled = 1, verified_at = NOW()
                 WHERE user_id = ?'
            )->execute([$userId]);

            $this->logAction($db, $userId, 'backup_code_ok', true);

            return $this->json($res, [
                'verified' => true,
                'method' => 'backup_code'
            ]);
        }

        $this->logAction($db, $userId, '2fa_fail', false);

        return $this->json($res, ['error' => 'Código incorrecto o expirado'], 401);
    }

    public function generateBackupCodes(Request $req, Response $res): Response
    {
        $userId = (int)$req->getAttribute('userId');
        $db = Database::getInstance();

        $stmt = $db->prepare('SELECT user_id FROM user_2fa WHERE user_id = ?');
        $stmt->execute([$userId]);

        if (!$stmt->fetch()) {
            return $this->json($res, ['error' => '2FA no configurado'], 404);
        }

        $plainCodes = [];
        $hashedCodes = [];

        while (count($plainCodes) < 8) {
            $code = $this->generateBackupCode();

            if (!in_array($code, $plainCodes, true)) {
                $plainCodes[] = $code;
                $hashedCodes[] = password_hash($code, PASSWORD_BCRYPT, ['cost' => 12]);
            }
        }

        $update = $db->prepare(
            'UPDATE user_2fa
             SET backup_codes = ?
             WHERE user_id = ?'
        );
        $update->execute([
            json_encode($hashedCodes, JSON_UNESCAPED_SLASHES),
            $userId
        ]);

        $this->logAction($db, $userId, 'backup_codes_generated', true);

        return $this->json($res, [
            'message' => 'Códigos de respaldo generados correctamente',
            'codes' => $plainCodes
        ]);
    }

    private function consumeBackupCode(PDO $db, int $userId, string $inputCode, ?string $backupCodesJson): bool
    {
        if (!$backupCodesJson) {
            return false;
        }

        $backupCodes = json_decode($backupCodesJson, true);

        if (!is_array($backupCodes) || empty($backupCodes)) {
            return false;
        }

        $normalizedInput = strtoupper(trim($inputCode));
        $remainingCodes = [];
        $matched = false;

        foreach ($backupCodes as $hash) {
            if (!$matched && is_string($hash) && password_verify($normalizedInput, $hash)) {
                $matched = true;
                continue;
            }

            $remainingCodes[] = $hash;
        }

        if (!$matched) {
            return false;
        }

        $update = $db->prepare(
            'UPDATE user_2fa
             SET backup_codes = ?
             WHERE user_id = ?'
        );
        $update->execute([
            json_encode(array_values($remainingCodes), JSON_UNESCAPED_SLASHES),
            $userId
        ]);

        return true;
    }

    private function generateBackupCode(): string
    {
        $part1 = strtoupper(bin2hex(random_bytes(2)));
        $part2 = strtoupper(bin2hex(random_bytes(2)));

        return $part1 . '-' . $part2;
    }

    private function json(Response $res, array $data, int $code = 200): Response
    {
        $res->getBody()->write(json_encode($data));

        return $res
            ->withHeader('Content-Type', 'application/json')
            ->withStatus($code);
    }

    private function logAction(PDO $db, ?int $userId, string $action, bool $success): void
    {
        $stmt = $db->prepare(
            'INSERT INTO auth_logs (user_id, action, ip_address, user_agent, success)
             VALUES (?, ?, ?, ?, ?)'
        );

        $stmt->execute([
            $userId,
            $action,
            $_SERVER['REMOTE_ADDR'] ?? null,
            $_SERVER['HTTP_USER_AGENT'] ?? null,
            $success ? 1 : 0
        ]);
    }
}
