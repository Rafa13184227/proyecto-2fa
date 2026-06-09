<?php

declare(strict_types=1);

use Dotenv\Dotenv;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Slim\Factory\AppFactory;

require __DIR__ . '/../vendor/autoload.php';

$dotenv = Dotenv::createImmutable(dirname(__DIR__));
$dotenv->load();

require __DIR__ . '/../config/database.php';
require __DIR__ . '/Controllers/AuthController.php';
require __DIR__ . '/Controllers/TwoFAController.php';
require __DIR__ . '/Middleware/JwtMiddleware.php';

$app = AppFactory::create();

$app->addBodyParsingMiddleware();
$app->addRoutingMiddleware();
$app->addErrorMiddleware((bool)($_ENV['APP_DEBUG'] ?? true), true, true);

$app->options('/{routes:.+}', function (Request $req, Response $res) {
    return $res;
});

$app->add(function (Request $req, $handler): Response {
    $res = $handler->handle($req);
    $origin = $_ENV['CORS_ORIGIN'] ?? 'http://localhost:4200';

    return $res
        ->withHeader('Access-Control-Allow-Origin', $origin)
        ->withHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With')
        ->withHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
        ->withHeader('Access-Control-Allow-Credentials', 'true');
});

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
