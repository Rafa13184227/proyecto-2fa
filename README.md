# proyecto-2fa

Sistema de autenticación en dos pasos (2FA).  
Hecho con Angular 17, Node.js (Express), PHP y MySQL.

## Requisitos

- Node.js 18+
- PHP 8.1+
- MySQL 8.0
- Redis 7 (para rate limiting, montado en docker)
- Composer
- Angular CLI (`npm install -g @angular/cli`)

## Configuración rápida

### 1. Base de datos

Ejecutá el script de la base de datos:

```sql
source database/schema.sql;
```

Esto crea la base `auth_2fa_db` con todas las tablas y un usuario admin de prueba.

### 2. Backend Node.js

```bash
cd backend-node
npm install
cp .env.example .env        # si tenés el ejemplo, sino editalo directo
```

El `.env` tiene que tener estas variablees

```
PORT=3000
DB_HOST=127.0.0.1
DB_USER=root
DB_PASS=
DB_NAME=auth_2fa_db
DB_PORT=3306
JWT_ACCESS_SECRET=un_secreto_largo_aca
JWT_REFRESH_SECRET=otro_secreto_distinto_aca
FRONTEND_URL=http://localhost:4200
REDIS_URL=redis://127.0.0.1:6379
```

Después levantás el servidor:

```bash
npm run dev
```

Si todo sale bien deberías ver: `✅ Redis conectado` y `🚀 Node API corriendo en http://localhost:3000`.

### 3. Backend PHP

```bash
cd backend-php
composer install
```

Copiá y configurá el archivo de entorno:

```
DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=auth_2fa_db
DB_USER=root
DB_PASS=
JWT_SECRET=un_secreto_para_jwt_aca
CORS_ORIGIN=http://localhost:4200
APP_DEBUG=true
```

Para levantar el servidor PHP usá el built-in de PHP o configurá tu Apache/Nginx:

```bash
php -S localhost:8080 -t public
```

### 4. Frontend Angular

```bash
cd frontend
npm install
ng serve
```

La app queda en `http://localhost:4200`.

## Usuarios de prueba

| Email | Contraseña | Rol |
|---|---|---|
| admin@test.com | Admin123! | admin |

Cuando te loguees por primera vez, entrá al dashboard y hacé clic en "Configurar 2FA".  
Escaneá el QR con Google Authenticator o Authy, ingresá el código y listo.

Para la próxima vez que entrés, te va a pedir el código de la app.

## Estructura del proyecto

```
proyecto-2fa/
├── database/
│   └── schema.sql            # Script de base de datos
├── backend-node/
│   └── src/
│       ├── server.js         # Punto de entrada
│       ├── routes/           # auth, twofa, course, admin
│       ├── middleware/       # verifyToken, verifyAdmin
│       └── utils/            # jwtHelper
├── backend-php/
│   └── src/
│       ├── Controllers/      # AuthController, TwoFAController
│       ├── Models/
│       └── Middleware/
├── frontend/
│   └── src/
│       └── app/
│           ├── pages/        # login, dashboard, admin-*, setup/verify 2fa
│           └── core/         # servicios, guards
└── docker-compose.yml        # Para levantar todo con Docker
```


Si preferís no instalar cada cosa por separado:

```bash
docker compose up -d
```

Esto levanta MySQL 8, Redis, el backend de Node y el backend de PHP con Nginx.  
Igual el frontend de Angular hay que levarlo aparte con `ng serve`.

## Notas

- El rate limiting de login está configurado a 5 intentos por IP cada 15 minutos (con Redis).
- Si Redis no está corriendo, el rate limit se desactiva automáticamente (no afecta el funcionamiento del servidor).
- El `.env` del backend Node no está subido al repo, tenés que crearlo vos.
- Los códigos de respaldo se generan desde el endpoint `/api/2fa/backup-codes` una vez que configuraste 2FA.

