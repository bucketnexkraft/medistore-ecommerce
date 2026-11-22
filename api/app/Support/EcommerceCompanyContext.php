<?php

namespace App\Support;

use App\Models\Company;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Relations\Relation;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Cache;

class EcommerceCompanyContext
{
    public const SESSION_KEY = 'ecommerce_company_id';

    public static function currentCompanyId(): ?string
    {
        if (app()->bound('request')) {
            $request = request();
            $isStorefrontRequest = self::shouldApplyToRequest($request);

            $companyId = $request->attributes->get('ecommerce_company_id');

            if (is_string($companyId) && trim($companyId) !== '') {
                return trim($companyId);
            }

            if ($isStorefrontRequest) {
                $companyId = self::resolveCompanyIdForRequest($request);

                if ($companyId !== null) {
                    $request->attributes->set('ecommerce_company_id', $companyId);
                    return $companyId;
                }

                if ($request->hasSession()) {
                    $companyId = $request->session()->get(self::SESSION_KEY);

                    if (is_string($companyId) && trim($companyId) !== '') {
                        $request->attributes->set('ecommerce_company_id', trim($companyId));
                        return trim($companyId);
                    }
                }

                return null;
            }
        }

        if (Auth::check() && !Auth::user()->isSuperAdmin()) {
            $companyId = (string) Auth::user()->company_id;

            return $companyId !== '' ? $companyId : null;
        }

        return null;
    }

    public static function applyScope(Builder|Relation $query, ?string $column = null): Builder|Relation
    {
        $companyId = self::currentCompanyId();

        if ($companyId === null) {
            return $query;
        }

        return $query->where($column ?: $query->qualifyColumn('company_id'), $companyId);
    }

    public static function shouldApplyToRequest(Request $request): bool
    {
        return $request->is('api/v1/home', 'api/v1/landing', 'api/v1/landing/*', 'api/v1/group-purchases/*', 'api/v1/customer/dashboard', 'api/v1/customer/*', 'api/v1/wishlists', 'api/v1/wishlists/*');
    }

    public static function resolveCompanyIdForRequest(Request $request): ?string
    {
        $current = $request->attributes->get('ecommerce_company_id');

        if (is_string($current) && trim($current) !== '') {
            return trim($current);
        }

        $companyId = self::resolveCompanyIdFromRequestDomain($request);

        if (is_string($companyId) && trim($companyId) !== '') {
            $request->attributes->set('ecommerce_company_id', trim($companyId));
        }

        return $companyId;
    }

    protected static function resolveCompanyIdFromRequestDomain(Request $request): ?string
    {
        $domain = self::resolveRequestDomain($request);

        if ($domain === null) {
            return null;
        }

        return Cache::remember('storefront:company-by-domain:'.$domain, now()->addMinutes(5), function () use ($domain) {
            // Domains are normalized when companies are saved, so use the
            // indexed equality lookup first. The regex fallback supports old
            // records without making every storefront request pay that cost.
            $companyId = Company::withoutGlobalScopes()
                ->where('domain', $domain)
                ->orWhere('custom_domain', $domain)
                ->value('company_id');

            if ($companyId) {
                return $companyId;
            }

            return Company::withoutGlobalScopes()
                ->where(function (Builder $query) use ($domain) {
                $normalizer = "
            LOWER(
                TRIM(
                    BOTH '/' FROM
                    REGEXP_REPLACE(
                        REGEXP_REPLACE(
                        REGEXP_REPLACE(%s, '^https?://', ''),
                            '^www\\.',
                            ''
                        ),
                        ':[0-9]+$',
                        ''
                    )
                )
            ) = ?
        ";

                    $query->whereRaw(sprintf($normalizer, 'domain'), [$domain])
                        ->orWhereRaw(sprintf($normalizer, 'custom_domain'), [$domain]);
                })
                ->value('company_id');
        });
    }

    protected static function resolveRequestDomain(Request $request): ?string
    {
        $candidates = [$request->headers->get('x-storefront-host'), $request->headers->get('origin'), $request->headers->get('referer'), $request->headers->get('x-forwarded-host'), $request->getHost()];

        foreach ($candidates as $candidate) {
            $domain = self::extractHost($candidate);

            if ($domain !== null) {
                return $domain;
            }
        }

        return null;
    }

    protected static function extractHost(?string $value): ?string
    {
        if (!is_string($value) || trim($value) === '') {
            return null;
        }

        $trimmed = trim($value);
        $parsedHost = parse_url($trimmed, PHP_URL_HOST);

        if (is_string($parsedHost) && $parsedHost !== '') {
            return self::normalizeDomain($parsedHost);
        }

        return self::normalizeDomain($trimmed);
    }

    protected static function normalizeDomain(?string $value): ?string
    {
        if (!is_string($value)) {
            return null;
        }

        $domain = strtolower(trim($value));
        $domain = preg_replace('#^https?://#', '', $domain);
        $domain = preg_replace('#/.*$#', '', $domain);
        $domain = preg_replace('#:\d+$#', '', $domain);
        $domain = preg_replace('#^www\.#', '', $domain);

        return $domain !== '' ? $domain : null;
    }
}
