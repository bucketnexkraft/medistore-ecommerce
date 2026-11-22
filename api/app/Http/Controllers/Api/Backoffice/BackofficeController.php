<?php

namespace App\Http\Controllers\Api\Backoffice;

use App\Http\Controllers\Controller;
use App\Services\Backoffice\BackofficeService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class BackofficeController extends Controller
{
    public function __construct(private readonly BackofficeService $backofficeService) {}

    private function ensureSuperAdmin()
    {
        $user = Auth::user();

        if (! $user || ! $user->isSuperAdmin()) {
            return response()->json([
                'status' => 0,
                'message' => 'Forbidden. Super admin access required.',
            ], 403);
        }

        return null;
    }

    public function companyUsers(Request $request, $companyId)
    {
        if ($forbidden = $this->ensureSuperAdmin()) {
            return $forbidden;
        }

        return $this->backofficeService->companyUsers($request, $companyId);
    }

    public function companyFeaturePreferences(Request $request, $companyId)
    {
        if ($forbidden = $this->ensureSuperAdmin()) {
            return $forbidden;
        }

        return $this->backofficeService->companyFeaturePreferences($request, $companyId);
    }

    public function storeCompanyFeaturePreference(Request $request, $companyId)
    {
        if ($forbidden = $this->ensureSuperAdmin()) {
            return $forbidden;
        }

        return $this->backofficeService->storeCompanyFeaturePreference($request, $companyId);
    }

    public function updateCompanyFeaturePreference(Request $request, $companyId, $id)
    {
        if ($forbidden = $this->ensureSuperAdmin()) {
            return $forbidden;
        }

        return $this->backofficeService->updateCompanyFeaturePreference($request, $companyId, $id);
    }

    public function deleteCompanyFeaturePreference(Request $request, $companyId, $id)
    {
        if ($forbidden = $this->ensureSuperAdmin()) {
            return $forbidden;
        }

        return $this->backofficeService->deleteCompanyFeaturePreference($request, $companyId, $id);
    }

    public function syncCompanyFeaturePreferences(Request $request, $companyId)
    {
        if ($forbidden = $this->ensureSuperAdmin()) {
            return $forbidden;
        }

        return $this->backofficeService->syncCompanyFeaturePreferences($request, $companyId);
    }

    public function featurePreferenceOptions()
    {
        if ($forbidden = $this->ensureSuperAdmin()) {
            return $forbidden;
        }

        return $this->backofficeService->featurePreferenceOptions();
    }

    public function impersonateCompanyUser(Request $request, $companyId, $userId)
    {
        if ($forbidden = $this->ensureSuperAdmin()) {
            return $forbidden;
        }

        return $this->backofficeService->impersonateCompanyUser($request, $companyId, $userId);
    }

    public function companyRights(Request $request, $companyId)
    {
        if ($forbidden = $this->ensureSuperAdmin()) {
            return $forbidden;
        }

        return $this->backofficeService->companyRights($request, $companyId);
    }

    public function updateCompanyRights(Request $request, $companyId)
    {
        if ($forbidden = $this->ensureSuperAdmin()) {
            return $forbidden;
        }

        return $this->backofficeService->updateCompanyRights($request, $companyId);
    }
}
