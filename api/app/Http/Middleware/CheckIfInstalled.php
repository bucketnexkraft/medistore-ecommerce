<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\File;
use Symfony\Component\HttpFoundation\Response;

class CheckIfInstalled
{
    /**
     * Handle an incoming request.
     *
     * @param  \Closure(\Illuminate\Http\Request): (\Symfony\Component\HttpFoundation\Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        if ($request->is('install*') || $request->is('api/v1/install-status')) {
            return $next($request);
        }
        if (!File::exists(storage_path('installed'))) {
            if ($request->is('api/*') || $request->expectsJson()) {
                return response()->json([
                    'status' => 0,
                    'code' => 'BACKEND_NOT_INSTALLED',
                    'message' => 'Backend is not installed yet.',
                ], 503);
            }
            return redirect()->route('installer.welcome');
        }

        return $next($request);
    }
}
