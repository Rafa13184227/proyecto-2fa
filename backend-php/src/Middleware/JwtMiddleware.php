<?php

declare(strict_types=1);

use Firebase\JWT\JWT;
use Firebase\JWT\Key;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Psr\Http\Server\RequestHandlerInterface as RequestHandler;
use Psr\Http\Server\MiddlewareInterface;

class JwtMiddleware implements MiddlewareInterface
{
    public function process(Request $request, RequestHandler $handler): Response
    {
        $authHeader = $request->getHeaderLine('Authorization');

        if (!preg_match('/^Bearer\s+(.+)$/i', $authHeader, $matches)) {
            return $this->jsonResponse([
                'error' => 'Token requerido'
            ], 401);
        }

        $token = trim($matches[1]);

        try {
            $decoded = JWT::decode(
                $token,
                new Key($_ENV['JWT_SECRET'], 'HS256')
            );

            $request = $request
                ->withAttribute('userId', (int)($decoded->sub ?? 0))
                ->withAttribute('jwt', $decoded);

            return $handler->handle($request);
        } catch (Throwable $e) {
            return $this->jsonResponse([
                'error' => 'Token inválido o expirado'
            ], 401);
        }
    }

    private function jsonResponse(array $data, int $status): Response
    {
        $response = new Slim\Psr7\Response();
        $response->getBody()->write(json_encode($data));

        return $response
            ->withHeader('Content-Type', 'application/json')
            ->withStatus($status);
    }
}
