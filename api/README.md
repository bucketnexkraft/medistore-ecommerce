# Stoqio

Stoqio is a Laravel application for inventory, POS, sales, purchases, warehouses, reporting, and SaaS backoffice management.

This project is installed in one of these two ways:

1. Web installer
2. Manual database import from `database/sql`

This repository does not rely on a migration-first setup for normal installation.

## Stack

- Backend: PHP 8.2+, Laravel, MySQL
- Auth: JWT token based API authentication
- Payments: Stripe, PayPal, Paystack, Flutterwave, SSLCommerz, Bank

## Project Structure

```text
.
|-- app/                  Laravel application code
|-- bootstrap/            Laravel bootstrap files
|-- config/               Application configuration
|-- database/sql/         SQL file(s) used for installation
|-- public/               Web root
|-- resources/            Blade views, language files, assets
|-- routes/               API and web routes
`-- storage/              Logs, cache, uploaded/generated files
```

## Requirements

- PHP 8.2 or higher
- Composer
- MySQL or MariaDB
- Node.js 18+ and npm
- A local server stack like Laragon, XAMPP, WAMP, or a custom PHP/MySQL setup

## Installation Method 1: Web Installer

Use this when you want the app to set up the database automatically from `database/sql`.

### Steps

1. Install backend dependencies:

```bash
composer install
```

2. Create `.env` from `.env.example`:

```bash
cp .env.example .env
```

PowerShell:

```powershell
Copy-Item .env.example .env
```

3. Generate the application key:

```bash
php artisan key:generate
```

4. Make sure you created a fresh empty database in MySQL.

Important:
The installer checks that the database is empty before importing SQL.

5. Start the Laravel server:

```bash
php artisan serve
```

6. Open the installer in your browser:

```text
http://127.0.0.1:8000/install
```

7. Complete the installer steps:

- Requirement check
- Permission check
- Database and app URL setup
- Admin account setup
- SMTP/email setup

### What the installer does

- Updates `.env`
- Verifies database connection
- Imports SQL from `database/sql`
- Creates the first super admin user
- Saves email configuration
- Creates `storage/installed`

## Installation Method 2: Manual SQL Import

Use this when you want to import the database yourself instead of using the installer.

### Steps

1. Install backend dependencies:

```bash
composer install
```

2. Create `.env` from `.env.example`:

```bash
cp .env.example .env
```

3. Generate the application key:

```bash
php artisan key:generate
```

4. Create a database in MySQL.

5. Import the SQL file from:

```text
database/sql/
```

If there is more than one `.sql` file, import the main dump used by your package.

6. Update database and app settings in `.env`:

```env
APP_NAME="Stoqio"
APP_URL="http://127.0.0.1:8000"
DB_CONNECTION="mysql"
DB_HOST="127.0.0.1"
DB_PORT="3306"
DB_DATABASE="your_database_name"
DB_USERNAME="root"
DB_PASSWORD=""
```

7. Configure mail settings in `.env` if email features are needed.

8. Start the backend:

```bash
php artisan serve
```

If you install manually and want the app treated as already installed, make sure `storage/installed` exists.

## Default Local URLs

- Backend: `http://127.0.0.1:8000`
- API: `http://127.0.0.1:8000/api/v1`

## Important Notes

- Normal installation uses SQL import, not `php artisan migrate`.
- The installer expects a fresh empty database.
- `APP_URL` must match your local/server setup.
- Payment gateways need valid live or test credentials before use.
- Mail settings are required for password reset, notifications, and other email features.
- Install status is tracked by `storage/installed`.

## Common Commands

Backend:

```bash
php artisan serve
php artisan route:list
php artisan optimize:clear
```

## Main API Entry Points

- `GET /api/v1/install-status`
- `POST /api/v1/login`
- `GET /api/v1/me`
- `GET /api/v1/dashboard`
- `GET /api/v1/backoffice/dashboard`

Most business routes require authenticated API access.

## Deployment Notes

1. Set correct production values in `.env`
2. Install composer dependencies:

```bash
composer install --no-dev --optimize-autoloader
```

3. Point your web server to Laravel `public/`
4. Make sure database import has already been completed
5. Configure queue, mail, storage permissions, and payment credentials

