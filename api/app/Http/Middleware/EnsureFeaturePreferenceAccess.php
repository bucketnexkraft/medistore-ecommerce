<?php

namespace App\Http\Middleware;

use App\Data\FeaturePreference;
use App\Utils\PermissionUtils;
use Closure;
use Illuminate\Http\Request;

class EnsureFeaturePreferenceAccess
{
    public function handle(Request $request, Closure $next, string $featureCode)
    {
        $user = auth()->user();

        if (!$user) {
            return response()->json([
                'status' => 0,
                'message' => 'Unauthenticated.',
            ], 401);
        }

        if (method_exists($user, 'isSuperAdmin') && $user->isSuperAdmin()) {
            return $next($request);
        }

        if (!in_array($featureCode, FeaturePreference::values(), true)) {
            return response()->json([
                'status' => 0,
                'message' => 'Invalid feature access rule.',
            ], 500);
        }

        $companyId = (string) ($user->company_id ?? '');
        $hasAccess = PermissionUtils::isFeatureAccessible($companyId, $featureCode);

        if (!$hasAccess) {
            return response()->json([
                'status' => 0,
                'message' => 'This module is not enabled for your active plan.',
                'feature' => $featureCode,
            ], 403);
        }

        return $next($request);
    }
}
