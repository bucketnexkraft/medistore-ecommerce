# Hostinger deployment

The source repository `OrFactor/Arcade` synchronizes only the `medex-demo-site(only-for-demo)` branch to the same branch in `bucketnexkraft/medistore-ecommerce`. The target repository then performs the Hostinger deployment. Pushing any other source branch does not run `.github/workflows/hostinger-deploy.yml`, and every Hostinger app must be configured to watch this same branch in the target repository.

The deployable applications are:

| Application | Repository root | Suggested URL | Hostinger type |
| --- | --- | --- | --- |
| Storefront | `./` | `https://medistore.nexkraft.com` | Next.js Web App |
| Admin | built `admin/dist` files | `https://medistoreadmin.nexkraft.com` | Static website |
| API | contents of `api` | `https://medistoreapi.nexkraft.com` | PHP/Laravel site |

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
| `HOSTINGER_API_DEPLOY_PATH` | `/home/u679789475/domains/nexkraft.com/public_html/medistoreapi` |
| `HOSTINGER_ADMIN_DEPLOY_PATH` | `/home/u679789475/domains/nexkraft.com/public_html/medistoreadmin` |

Create these secrets in the **target** repository:

| Secret | Purpose |
| --- | --- |
| `HOSTINGER_SSH_HOST` | Hostinger SSH hostname |
| `HOSTINGER_SSH_PORT` | Hostinger SSH port, commonly `65002` on web hosting or `22` on a VPS |
| `HOSTINGER_SSH_USER` | Hostinger SSH username |
| `HOSTINGER_SSH_PRIVATE_KEY` | Private key authorized by the Hostinger account |

The workflow uses the GitHub `production` environment for the API/admin deployment. The four `PRODUCTION_*` values must remain **repository variables** because the build jobs do not use that environment. The four `HOSTINGER_SSH_*` values may be repository secrets or secrets in the `production` environment. The two `HOSTINGER_*_DEPLOY_PATH` values may be repository variables or variables in that environment; using the repository locations for all values is the simplest setup.

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

## 3. Admin static site

Create the `medistoreadmin.nexkraft.com` directory as a static PHP/HTML website. GitHub Actions builds Vite with the `PRODUCTION_*` repository variables and uploads the contents of `admin/dist` directly to `HOSTINGER_ADMIN_DEPLOY_PATH`. The generated artifact includes `admin/public/.htaccess` for React Router fallback. No Git checkout, Node runtime, or server-side admin `.env` is required.

## 4. API direct deployment

Create the API subdomain as a PHP website using PHP 8.2 or newer. Do not initialize Git in this folder. Before the first deployment, create the persistent production environment file directly at the API document root:

```bash
mkdir -p /home/u679789475/domains/nexkraft.com/public_html/medistoreapi
nano /home/u679789475/domains/nexkraft.com/public_html/medistoreapi/.env
```

GitHub Actions uploads the contents of the repository's `api` directory directly into `HOSTINGER_API_DEPLOY_PATH`. This places Laravel's `.htaccess`, `artisan`, and `public` directory at the API subdomain root. The upload excludes and preserves `.env`, `storage`, `vendor`, and log files.

The deployment then installs production Composer dependencies, creates required storage directories, runs database migrations with `--force`, refreshes Laravel caches, and brings the API out of maintenance mode.

## 5. Production API environment

At minimum, set these values in the persistent Hostinger `medistoreapi/.env` alongside the database, mail, JWT, and payment credentials:

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
