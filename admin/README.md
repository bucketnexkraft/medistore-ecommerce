# Stoqio Frontend

This folder contains the React + Vite frontend for **Stoqio - SaaS Stock & Inventory Management System**.

It is the web client used for:

- public landing pages
- company login and registration
- inventory and stock management dashboard
- POS, sales, purchase, warehouse, and invoice workflows
- reports and analytics screens
- SaaS plan checkout pages
- backoffice administration pages for super admin users

## Stack

- React 18
- Vite 6
- React Router
- Redux Toolkit
- Axios
- Tailwind CSS 3
- MUI

## Requirements

- Node.js 18 or higher
- npm
- A working Stoqio Laravel backend API

## Important Before You Start

This frontend does **not** work as a standalone product.

It requires the Stoqio Laravel backend to be installed and reachable through HTTP or HTTPS. The frontend communicates with the backend API for:

- authentication
- company registration
- landing page content
- products, stock, sales, purchases, invoices
- reports
- backoffice data
- translations and language packs

## API Configuration

The frontend reads its API configuration from Vite environment variables.

Start by copying:

```text
.env.example -> .env
```

Example `.env`:

```env
VITE_API_URL=https://api.yourdomain.com/api/v1
VITE_API_BASE_URL=https://api.yourdomain.com
```

Meaning:

- `VITE_API_URL`: main backend API endpoint used by the frontend
- `VITE_API_BASE_URL`: optional backend base URL used for CMS/media URL resolution

Important:

- include `/api/v1` at the end of `VITE_API_URL`
- do not add a trailing slash
- after changing `.env`, run a fresh build

If `VITE_API_URL` is not set, the frontend falls back to:

```text
/api/v1
```

That fallback is useful for same-domain deployments where frontend and backend are served from the same origin.

## Installation for Local Development

Open terminal inside this folder and run:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

By default, Vite is configured to run on:

```text
http://localhost:5173
```

The current Vite config also exposes the dev server on:

```text
host: 0.0.0.0
port: 5173
```

So it can be accessed from other devices in the same network if needed.

## Production Build

To create the production build:

```bash
npm run build
```

This generates the compiled output in:

```text
dist/
```

You should upload the **contents of `dist/`**, not the full source code, when deploying the frontend separately.

## Separate Domain Deployment

This frontend can be hosted on a separate domain or subdomain from the Laravel backend.

Example architecture:

- Frontend: `https://app.yourdomain.com`
- Backend: `https://api.yourdomain.com/api/v1`

### Deployment Steps

1. Copy `.env.example` to `.env`
2. Set `VITE_API_URL` and, if needed, `VITE_API_BASE_URL`
3. Run `npm run build`
4. Upload all files from `dist/` to your frontend domain document root
5. Add SPA rewrite rules so React routes fall back to `index.html`
6. Allow your frontend domain in Laravel CORS config
7. Enable HTTPS on both frontend and backend

## Apache Rewrite Rule

If you deploy on Apache, create or update `.htaccess` in the frontend document root:

```apache
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /
  RewriteRule ^index\.html$ - [L]
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteRule . /index.html [L]
</IfModule>
```

## Nginx Example

```nginx
server {
  listen 80;
  server_name app.yourdomain.com;
  root /var/www/stoqio-frontend/dist;
  index index.html;

  location / {
    try_files $uri $uri/ /index.html;
  }
}
```

## Backend CORS Requirement

If frontend and backend run on different domains, update Laravel CORS configuration in:

`stoqio-web/config/cors.php`

Example:

```php
'allowed_origins' => [
    'https://app.yourdomain.com',
],
```

Do not use overly broad wildcard CORS rules in production unless you intentionally want that behavior.

## Authentication Notes

The frontend expects JWT-style authenticated API access from the backend.

It uses bearer tokens for protected requests and automatically redirects unauthenticated users to `/login` when a `401 Unauthorized` response is returned.

## Routing Notes

The frontend uses `createBrowserRouter`, so direct refresh on routes like:

- `/dashboard`
- `/stock/overview`
- `/backoffice/dashboard`

will fail with `404` unless SPA fallback rewrite rules are configured correctly.

## Main Frontend Areas

This frontend includes screens for:

- dashboard
- products, categories, brands, variants, bundles, units
- barcode management
- warehouses
- purchases and purchase returns
- stock overview, stock history, stock transfers, stock timeline, StockGuard
- sales, POS, stock out, waitlists
- invoices
- reports
- users and profile
- company preferences
- SaaS plans and plan payment checkout
- backoffice companies, gateways, currencies, content, blogs, newsletters, logs, and settings

## Useful Commands

Install dependencies:

```bash
npm install
```

Run development server:

```bash
npm run dev
```

Build for production:

```bash
npm run build
```

Preview built app locally:

```bash
npm run preview
```

Run lint:

```bash
npm run lint
```

## Troubleshooting

### Blank page after deployment

Most common causes:

- wrong API URL
- uploaded the `dist` folder instead of the contents inside `dist`
- JavaScript files not uploaded correctly

### 404 on page refresh

Cause:

- missing Apache or Nginx SPA rewrite rule

### Login or API requests fail

Check:

- backend is installed and reachable
- `API_URL` is correct
- Laravel CORS allows the frontend origin
- HTTPS is configured correctly

### Still calling demo server

Cause:

- `.env` still points to an old or demo API URL
- frontend was not rebuilt after changing the environment configuration

### CORS error in browser console

Cause:

- backend `allowed_origins` does not include the frontend domain

## Buyer Notes

- This frontend is source code, not a pre-hosted SaaS service
- You must install and configure the Laravel backend first
- You must configure `.env` before using this frontend in your own environment
- Public landing content is loaded from backend-managed CMS and section APIs

## Related Package Paths

- Laravel backend: `../stoqio-web`
- Documentation: `../documentaion`
- Mobile app source: `../stoqio_app`
