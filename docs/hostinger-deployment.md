# Hostinger deployment

The source repository `OrFactor/Arcade` synchronizes only the `medex-demo-site(only-for-demo)` branch to the same branch in `bucketnexkraft/medistore-ecommerce`. The target repository then performs the Hostinger deployment. Pushing any other source branch does not run `.github/workflows/hostinger-deploy.yml`, and every Hostinger app must be configured to watch this same branch in the target repository.

The deployable applications are:

| Application | Repository root | Suggested URL | Hostinger type |
| --- | --- | --- | --- |
| Storefront | `./` | `https://medistore.nexkraft.com` | Next.js Web App |
| Admin | `admin` | `https://medistoreadmin.nexkraft.com` | Vite Web App |
| API | `api` within the server checkout | `https://medistoreapi.nexkraft.com` | PHP/Laravel site |

The `landing` directory is not built or deployed.

## 1. GitHub repository settings

In the **source** repository (`OrFactor/Arcade`), create this Actions secret:

| Secret | Purpose |
| --- | --- |
| `TARGET_REPO_TOKEN` | Fine-grained token scoped to `bucketnexkraft/medistore-ecommerce`, with Contents read/write and permission to update workflow files |

The synchronization excludes `landing`, the three real `.env` files, database dumps (`*.sql`, `*.sql.gz`, `*.dump`), log files, and Git metadata. It creates ordinary commits in the target branch and never force-pushes.

In the **target** repository (`bucketnexkraft/medistore-ecommerce`), create these repository variables under **Settings → Secrets and variables → Actions → Variables**:

| Variable | Example |
| --- | --- |
| `PRODUCTION_API_URL` | `https://medistoreapi.nexkraft.com` |
| `PRODUCTION_API_V1_URL` | `https://medistoreapi.nexkraft.com/api/v1` |
| `PRODUCTION_ADMIN_URL` | `https://medistoreadmin.nexkraft.com` |
| `PRODUCTION_STOREFRONT_URL` | `https://medistore.nexkraft.com` |
| `HOSTINGER_API_DEPLOY_PATH` | `/home/u123456789/domains/medistoreapi.nexkraft.com/public_html` |

Create these secrets in the **target** repository:

| Secret | Purpose |
| --- | --- |
| `HOSTINGER_SSH_HOST` | Hostinger SSH hostname |
| `HOSTINGER_SSH_PORT` | Hostinger SSH port, commonly `65002` on web hosting or `22` on a VPS |
| `HOSTINGER_SSH_USER` | Hostinger SSH username |
| `HOSTINGER_SSH_PRIVATE_KEY` | Private key authorized by the Hostinger account |

The workflow uses the GitHub `production` environment for the API deployment. The four `PRODUCTION_*` values must remain **repository variables** because the storefront and admin validation jobs do not use that environment. The four `HOSTINGER_SSH_*` values may be repository secrets or secrets in the `production` environment. `HOSTINGER_API_DEPLOY_PATH` may be a repository variable or a variable in that environment; using the repository locations for all values is the simplest setup.

## 2. Storefront web app

In Hostinger, create a Web App for the storefront subdomain and connect `bucketnexkraft/medistore-ecommerce`.

- Branch: `medex-demo-site(only-for-demo)`
- Framework: Next.js
- Node.js: 20.x
- Root directory: `./`
- Package manager: npm
- Build command: `npm run build`
- Output directory: `.next`
- Start command: `npm run start`

Add these Hostinger environment variables:

```dotenv
NEXT_PUBLIC_API_URL=https://medistoreapi.nexkraft.com
NEXT_PUBLIC_API_BASE_URL=https://medistoreapi.nexkraft.com/api/v1
NEXT_PUBLIC_ADMIN_URL=https://medistoreadmin.nexkraft.com
NEXT_PUBLIC_STORE_URL=https://medistore.nexkraft.com
NEXT_PUBLIC_STORAGE_URL=https://medistoreapi.nexkraft.com
```

Enable automatic deployment for only `medex-demo-site(only-for-demo)`.

## 3. Admin web app

Create another Hostinger Web App for the admin subdomain from the same repository.

- Branch: `medex-demo-site(only-for-demo)`
- Framework: Vite
- Node.js: 20.x
- Root directory: `admin`
- Package manager: npm
- Build command: `npm run build`
- Output directory: `dist`

Add these Hostinger environment variables:

```dotenv
VITE_API_URL=https://medistoreapi.nexkraft.com/api/v1
VITE_API_BASE_URL=https://medistoreapi.nexkraft.com
```

Enable automatic deployment for only `medex-demo-site(only-for-demo)`. The committed `admin/public/.htaccess` provides the React Router fallback in the generated `dist` directory.

## 4. API site and first checkout

Create the API subdomain as a PHP website using PHP 8.2 or newer. Its document root must contain a Git checkout of this repository on the deployment branch. This follows the same server-side Git checkout pattern used by `bpatc-hospital-management`.

Initial server setup:

```bash
cd /home/USER/domains/API_DOMAIN/public_html
git clone --branch 'medex-demo-site(only-for-demo)' git@github.com:bucketnexkraft/medistore-ecommerce.git .
cp api/.env.example api/.env
cd api
composer2 install --no-dev --prefer-dist --optimize-autoloader
php artisan key:generate
php artisan storage:link
```

Keep `api/.env`, `api/storage`, and uploaded files on the server. They are ignored by Git and are not replaced by the workflow.

Configure the API subdomain document root to the checkout's `api/public` directory. If the Hostinger plan cannot change the document root, create the API subdomain so its `public_html` points or symlinks to `api/public`, or use the existing `api/.htaccess` front-controller arrangement.

The GitHub Actions deployment then performs:

1. Fetch and reset to `origin/medex-demo-site(only-for-demo)`.
2. Install production Composer dependencies.
3. Run database migrations with `--force`.
4. Refresh Laravel configuration, route, and view caches.
5. Bring the API out of maintenance mode.

## 5. Production API environment

At minimum, set these values in the persistent Hostinger `api/.env` alongside the database, mail, JWT, and payment credentials:

```dotenv
APP_ENV=production
APP_DEBUG=false
APP_URL=https://medistoreapi.nexkraft.com
APP_FRONTEND_URL=https://medistore.nexkraft.com
APP_ADMIN_FRONTEND_URL=https://medistoreadmin.nexkraft.com
ADMIN_LOGIN_URL=https://medistoreadmin.nexkraft.com/login
ALLOWED_ORIGIN_URLS=https://medistore.nexkraft.com,https://medistoreadmin.nexkraft.com
DEMO_STOREFRONT_URL=https://medistore.nexkraft.com
LOCAL_ECOMMERCE_DOMAIN=
```

The Kawsar storefront company must keep `medistore.nexkraft.com` as its `domain` or verified `custom_domain`. This ensures public storefront requests resolve only company `6a956fbdd5915-comp-27150314979125825`.

## 6. DNS and health checks

Point all three subdomains to Hostinger and enable SSL before the first production test. After deployment, verify:

```text
https://medistoreapi.nexkraft.com/api/v1/install-status
https://medistoreadmin.nexkraft.com/login
https://medistore.nexkraft.com/
```

Do not connect the `landing` directory to a Hostinger website.
