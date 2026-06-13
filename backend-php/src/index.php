<?php

declare(strict_types=1);

use Slim\Factory\AppFactory;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;

require __DIR__ . '/../vendor/autoload.php';

$envFile = __DIR__ . '/../.env';

if (file_exists($envFile)) {
    $lines = file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);

    foreach ($lines as $line) {
        $line = trim($line);

        if ($line === '' || str_starts_with($line, '#')) {
            continue;
        }

        $parts = explode('=', $line, 2);

        if (count($parts) === 2) {
            $key = trim($parts[0]);
            $value = trim($parts[1]);
            $value = trim($value, '"\'');
            $_ENV[$key] = $value;
            putenv("{$key}={$value}");
        }
    }
}

$origin = $_ENV['CORS_ORIGIN'] ?? 'http://localhost:4200';

header("Access-Control-Allow-Origin: {$origin}");
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Credentials: true');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require __DIR__ . '/../config/database.php';
require __DIR__ . '/Controllers/AuthController.php';
require __DIR__ . '/Controllers/TwoFAController.php';
require __DIR__ . '/Middleware/JwtMiddleware.php';

$app = AppFactory::create();

$app->addBodyParsingMiddleware();
$app->addRoutingMiddleware();
$app->addErrorMiddleware((bool)($_ENV['APP_DEBUG'] ?? true), true, true);

$app->get('/api/health', function (Request $req, Response $res) {
    $res->getBody()->write(json_encode(['status' => 'ok']));
    return $res->withHeader('Content-Type', 'application/json');
});

$auth = new AuthController();
$tfa = new TwoFAController();
$jwt = new JwtMiddleware();

$app->post('/api/auth/register', [$auth, 'register']);
$app->post('/api/auth/login', [$auth, 'login']);
$app->post('/api/auth/logout', [$auth, 'logout'])->add($jwt);

$app->post('/api/2fa/setup', [$tfa, 'setup'])->add($jwt);
$app->post('/api/2fa/verify', [$tfa, 'verify'])->add($jwt);
$app->post('/api/2fa/backup-codes', [$tfa, 'generateBackupCodes'])->add($jwt);

$app->run();
