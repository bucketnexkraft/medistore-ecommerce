<?php

namespace App\Http\Middleware;

use App\Models\Company;
use App\Support\EcommerceCompanyContext;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class UseLocalEcommerceCompany
{
    public function handle(Request $request, Closure $next): Response
    {
        if (! app()->environment('local') || ! EcommerceCompanyContext::shouldApplyToRequest($request)) {
            return $next($request);
        }

        $resolvedCompanyId = $request->attributes->get('ecommerce_company_id');

        if (is_string($resolvedCompanyId) && trim($resolvedCompanyId) !== '') {
            return $next($request);
        }

        $requestHost = $this->normalizeHost(
            $request->headers->get('x-storefront-host')
                ?: $request->headers->get('x-forwarded-host')
                ?: $request->getHost()
        );
        $demoHost = $this->normalizeHost((string) config('app.demo_storefront_url'));
        $localCompanyDomain = $this->normalizeHost((string) config('app.local_ecommerce_domain'));

        if ($requestHost === null || $requestHost !== $demoHost || $localCompanyDomain === null) {
            return $next($request);
        }

        $companyId = Company::withoutGlobalScopes()
            ->where('domain', $localCompanyDomain)
            ->orWhere('custom_domain', $localCompanyDomain)
            ->value('company_id');

        if (is_string($companyId) && trim($companyId) !== '') {
            $companyId = trim($companyId);
            $request->attributes->set('ecommerce_company_id', $companyId);

            if ($request->hasSession()) {
                $request->session()->put(EcommerceCompanyContext::SESSION_KEY, $companyId);
            }
        }

        return $next($request);
    }

    private function normalizeHost(?string $value): ?string
    {
        if (! is_string($value) || trim($value) === '') {
            return null;
        }

        $value = trim($value);
        $host = parse_url($value, PHP_URL_HOST);

        if (! is_string($host) || $host === '') {
            $host = preg_replace('#^https?://#i', '', $value);
            $host = preg_replace('#/.*$#', '', (string) $host);
            $host = preg_replace('#:\d+$#', '', (string) $host);
        }

        $host = strtolower(trim((string) $host));
        $host = preg_replace('#^www\.#', '', $host);

        return $host !== '' ? $host : null;
    }
}
