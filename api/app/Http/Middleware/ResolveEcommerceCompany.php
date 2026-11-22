<?php

namespace App\Http\Middleware;

use App\Support\EcommerceCompanyContext;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class ResolveEcommerceCompany
{
    public function handle(Request $request, Closure $next): Response
    {
        if (! EcommerceCompanyContext::shouldApplyToRequest($request)) {
            return $next($request);
        }

        $companyId = EcommerceCompanyContext::resolveCompanyIdForRequest($request);

        if ($companyId !== null) {
            $request->attributes->set('ecommerce_company_id', $companyId);

            if ($request->hasSession()) {
                $request->session()->put(EcommerceCompanyContext::SESSION_KEY, $companyId);
            }
        } elseif ($request->hasSession()) {
            $request->session()->forget(EcommerceCompanyContext::SESSION_KEY);
        }

        return $next($request);
    }
}
