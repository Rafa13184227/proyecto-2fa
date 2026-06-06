<?php
declare(strict_types=1);

use Slim\Factory\AppFactory;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;

require __DIR__ . '/../../vendor/autoload.php';
require __DIR__ . '/../config/database.php';
require __DIR__ . '/Controllers/AuthController.php';
require __DIR__ . '/Controllers/TwoFAController.php';

$app = AppFactory::create();
$app->addBodyParsingMiddleware();
$app->addRoutingMiddleware();
$app->addErrorMiddleware(true, true, true);

$app->get('/api/health', function (Request $req, Response $res) {
    $res->getBody()->write(json_encode(['status' => 'ok']));
    return $res->withHeader('Content-Type', 'application/json');
});

$auth = new AuthController();
$tfa  = new TwoFAController();

$app->post('/api/auth/register', [$auth, 'register']);
$app->post('/api/auth/login', [$auth, 'login']);
$app->post('/api/2fa/setup', [$tfa, 'setup']);
$app->post('/api/2fa/verify', [$tfa, 'verify']);

$app->run();