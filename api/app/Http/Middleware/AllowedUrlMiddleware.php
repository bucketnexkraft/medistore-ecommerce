<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

class AllowedUrlMiddleware
{
    public function handle(Request $request, Closure $next)
    {
        $origin = $request->headers->get('origin') ?? $request->headers->get('referer');

        if (!$origin) {
            return $next($request);
        }

        if (in_array(parse_url($origin, PHP_URL_HOST), $this->getAllowedHosts(), true)) {
            return $next($request);
        }

        return response()->json(['error' => 'Unauthorized'], 403);
    }

    protected function getAllowedHosts()
    {
        $configured = array_filter(array_map('trim', explode(',', (string) env('ALLOWED_ORIGIN_URLS', ''))));

        $defaults = array_filter([
            config('app.url'),
            env('APP_FRONTEND_URL'),
        ]);

        $urls = array_unique(array_merge($configured, $defaults));

        return array_values(array_filter(array_map(function ($url) {
            return parse_url($url, PHP_URL_HOST);
        }, $urls)));
    }
}
