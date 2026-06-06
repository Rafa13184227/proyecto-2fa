
#!/bin/bash

# Crear directorio raíz del proyecto
mkdir -p proyecto-2fa2
cd proyecto-2fa2





# --- 2. ESTRUCTURA BACKEND NODE.JS ---
mkdir -p backend-node/src/routes
mkdir -p backend-node/src/middleware
mkdir -p backend-node/src/utils

# Crear archivos de Node.js
touch backend-node/src/server.js
touch backend-node/src/routes/auth.routes.js
touch backend-node/src/routes/twofa.routes.js
touch backend-node/src/middleware/verifyToken.js
touch backend-node/src/utils/jwtHelper.js
touch backend-node/.env

# --- 3. ESTRUCTURA BACKEND PHP (Slim Framework) ---
mkdir -p backend-php/src/Controllers
mkdir -p backend-php/src/Models
mkdir -p backend-php/config

# Crear archivos de PHP
touch backend-php/src/index.php
touch backend-php/src/Controllers/AuthController.php
touch backend-php/src/Controllers/TwoFAController.php
touch backend-php/src/Models/UserModel.php
touch backend-php/config/database.php

# --- 4. BASE DE DATOS GLOBAL ---
mkdir -p database
touch database/schema.sql

echo "¡Estructura de arquitectura multiplataforma 'proyecto-2fa' creada con éxito por el Profe Alex!"
