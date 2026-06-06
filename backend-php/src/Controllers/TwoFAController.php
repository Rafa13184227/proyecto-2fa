<?php
declare(strict_types=1);

use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use RobThree\Auth\TwoFactorAuth;
use RobThree\Auth\Algorithm;
use RobThree\Auth\Providers\Qr\QRServerProvider;

class TwoFAController
{
    private TwoFactorAuth $tfa;

    public function __construct()
    {
        $this->tfa = new TwoFactorAuth(
            new QRServerProvider(),
            'MiApp 2FA',
            6,
            30,
            Algorithm::Sha1
        );
    }

    /** POST /api/2fa/setup — Genera secreto y QR */
    public function setup(Request $req, Response $res): Response
    {
        $userId = $req->getAttribute('userId');
        $db = Database::getInstance();

        $stmt = $db->prepare('SELECT email FROM users WHERE id = ?');
        $stmt->execute([$userId]);
        $user = $stmt->fetch();

        if (!$user) {
            return $this->json($res, ['error' => 'Usuario no encontrado'], 404);
        }

        $secret = $this->tfa->createSecret(160);

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

    /** POST /api/2fa/verify — Verificar código TOTP */
    public function verify(Request $req, Response $res): Response
    {
        $body = $req->getParsedBody();
        $userId = $req->getAttribute('userId');
        $code = preg_replace('/\D/', '', $body['code'] ?? '');

        $db = Database::getInstance();

        $stmt = $db->prepare('SELECT secret FROM user_2fa WHERE user_id = ?');
        $stmt->execute([$userId]);
        $record = $stmt->fetch();

        if (!$record) {
            return $this->json($res, ['error' => '2FA no configurado'], 404);
        }

        $isValid = $this->tfa->verifyCode(
            $record['secret'],
            $code,
            1
        );

        if (!$isValid) {
            return $this->json($res, ['error' => 'Código incorrecto o expirado'], 401);
        }

        $db->prepare(
            'UPDATE user_2fa SET is_enabled = 1, verified_at = NOW() WHERE user_id = ?'
        )->execute([$userId]);

        return $this->json($res, ['verified' => true]);
    }

    private function json(Response $res, array $data, int $code = 200): Response
    {
        $res->getBody()->write(json_encode($data));
        return $res->withHeader('Content-Type', 'application/json')->withStatus($code);
    }
}